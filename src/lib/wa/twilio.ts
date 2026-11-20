/**
 * Twilio WhatsApp client: direct REST calls, no SDK (keeps the serverless bundle small).
 * Server only. The Auth Token never leaves the server and is never logged.
 * Verified against Twilio docs (Nov 2026):
 *  - send    POST /2010-04-01/Accounts/{SID}/Messages.json  Basic auth (SID:token), form body To/From/Body|MediaUrl/StatusCallback
 *  - inbound form-encoded POST to our URL; X-Twilio-Signature = base64(HMAC-SHA1(token, url + sorted(key+value)))
 *  - Body ≤ 1600 chars. A Body sent with a document/audio is dropped, so a PDF goes alone. Media only inside the 24h session.
 *  - Trial: 50 messages per rolling 24h (error 63038), sandbox join expires after 3 days (63015), 63016 = outside the 24h window.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { WaError, normalizePhone, type WaErrorKind } from "./cloud";

const API = "https://api.twilio.com/2010-04-01";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** sender in E.164 with "+", e.g. +17372508034 */
  from: string;
  /** "dry" never calls Twilio: replies are logged only. For tests and rehearsal. */
  mode: "live" | "dry";
  /** hard stop on outbound messages in a rolling 24h (the trial allows 50, errors 63038 beyond that) */
  dailyCap: number;
  /** sandbox join phrase, shown on the connect screen */
  joinCode: string;
}

export const DEFAULT_DAILY_CAP = 40;

export function twilioConfig(env: Record<string, string | undefined> = process.env): TwilioConfig | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const rawFrom = env.TWILIO_WHATSAPP_FROM?.trim().replace(/^whatsapp:/i, "");
  if (!accountSid || !authToken || !rawFrom) return null;
  const digits = normalizePhone(rawFrom);
  if (!digits) return null;
  const cap = Number(env.TWILIO_DAILY_CAP);
  return {
    accountSid,
    authToken,
    from: `+${digits}`,
    mode: env.TWILIO_SEND_MODE?.trim().toLowerCase() === "dry" ? "dry" : "live",
    dailyCap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : DEFAULT_DAILY_CAP,
    joinCode: env.TWILIO_SANDBOX_JOIN_CODE?.trim() || "join twilio-trial",
  };
}

/** "whatsapp:+919876543210" ← digits "919876543210" */
export const toWhatsApp = (digits: string) => `whatsapp:+${digits.replace(/\D/g, "")}`;

/* ---------------- errors ---------------- */

export function classifyTwilio(code: number | null, httpStatus: number): { kind: WaErrorKind; message: string } {
  switch (code) {
    case 63016:
      return { kind: "window", message: "24 ghante se zyada ho gaye. WhatsApp par ek baar 'Hi' bhejo, phir dobara try karo." };
    case 63015:
      return { kind: "not_allowed", message: "Yeh number sandbox se jud nahi hai (ya 3 din ka join khatam ho gaya). WhatsApp par join code dobara bhejo." };
    case 63038:
      return { kind: "rate", message: "Twilio trial ki roz ki message limit poori ho gayi. Kal dobara try karo." };
    case 20003:
      return { kind: "token", message: "Twilio Auth Token galat hai. Naya token .env mein daalo." };
    case 21211:
    case 21614:
      return { kind: "bad_number", message: "Yeh number WhatsApp par nahi mila ya galat hai. Number check karo." };
    case 21654:
      // Twilio trial: the Messages API accepts only to/from/ContentSid/statusCallback, so free text is refused.
      // https://www.twilio.com/docs/usage/trials/try-out-whatsapp
      return { kind: "not_allowed", message: "Twilio trial account custom message nahi bhej sakta (sirf Twilio ke fixed templates). Twilio account upgrade karo, tab bot ke jawab jayenge." };
    case 21608:
      return { kind: "not_allowed", message: "Trial account mein sirf verified numbers par message jaata hai. Twilio Console mein number verify karo." };
    case 20429:
    case 63018:
      return { kind: "rate", message: "Bahut zyada messages gaye. Thodi der baad try karo." };
  }
  if (httpStatus === 401) return { kind: "token", message: "Twilio Auth Token galat hai. Naya token .env mein daalo." };
  return { kind: "other", message: "WhatsApp message nahi ja paya. Thodi der baad dobara try karo." };
}

/* ---------------- send ---------------- */

type Fetch = typeof fetch;

const basic = (c: TwilioConfig) => `Basic ${Buffer.from(`${c.accountSid}:${c.authToken}`).toString("base64")}`;

async function createMessage(c: TwilioConfig, form: Record<string, string>, f: Fetch): Promise<{ sid: string }> {
  let res: Response;
  try {
    res = await f(`${API}/Accounts/${c.accountSid}/Messages.json`, {
      method: "POST",
      headers: { authorization: basic(c), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new WaError("Twilio tak pahunch nahi paye. Internet check karo.", "other", null, 0);
  }
  const data = (await res.json().catch(() => null)) as { sid?: string; code?: number; message?: string } | null;
  if (!res.ok || !data?.sid) {
    const code = typeof data?.code === "number" ? data.code : null;
    const k = classifyTwilio(code, res.status);
    // Twilio's own message can carry the number: keep it out of logs
    console.error("[twilio] send failed", { httpStatus: res.status, code });
    throw new WaError(k.message, k.kind, code, res.status);
  }
  return { sid: data.sid };
}

/** `statusCallback` is the public URL Twilio posts delivery updates to (must be https with a real hostname). */
export const sendTwilioText = (c: TwilioConfig, to: string, body: string, opts: { statusCallback?: string | null } = {}, f: Fetch = fetch) =>
  createMessage(c, { To: toWhatsApp(to), From: toWhatsApp(c.from), Body: body, ...(opts.statusCallback ? { StatusCallback: opts.statusCallback } : {}) }, f);

/** A document/image alone: WhatsApp drops any Body sent with a document. Session (24h) only. */
export const sendTwilioMedia = (c: TwilioConfig, to: string, mediaUrl: string, opts: { statusCallback?: string | null } = {}, f: Fetch = fetch) =>
  createMessage(c, { To: toWhatsApp(to), From: toWhatsApp(c.from), MediaUrl: mediaUrl, ...(opts.statusCallback ? { StatusCallback: opts.statusCallback } : {}) }, f);

/** Download an inbound attachment (voice note, bill photo). Sends Basic auth: works whether or not the Console requires it. */
export async function fetchTwilioMedia(c: TwilioConfig, url: string, f: Fetch = fetch, maxBytes = 8 * 1024 * 1024): Promise<{ bytes: Uint8Array; mime: string }> {
  // only ever send credentials to Twilio's own hosts
  const host = new URL(url).hostname;
  if (!host.endsWith(".twilio.com") && host !== "twilio.com") throw new WaError("Media link Twilio ka nahi hai.", "other", null, 0);
  const res = await f(url, { headers: { authorization: basic(c) }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new WaError("Attachment download nahi ho paya.", "other", null, res.status);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new WaError("Attachment bahut bada hai.", "other", null, 413);
  return { bytes: buf, mime: (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim() };
}

/* ---------------- webhook ---------------- */

export type FormParams = Record<string, string | string[]>;

/** Same recipe as Twilio's SDK (webhooks.js): url + for each key sorted, key+value (repeated keys: unique, sorted). */
export function expectedSignature(authToken: string, url: string, params: FormParams): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      const v = params[key];
      return acc + (Array.isArray(v) ? [...new Set(v)].sort().map((x) => key + x).join("") : key + v);
    }, url);
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

/** Constant-time check of X-Twilio-Signature. `url` must be the exact public URL Twilio called, including any query string. */
export function verifyTwilioSignature(authToken: string, header: string | null, url: string, params: FormParams): boolean {
  if (!header) return false;
  const want = Buffer.from(expectedSignature(authToken, url, params));
  const got = Buffer.from(header);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** The URL Twilio signed. Behind Vercel's proxy req.url can differ, so prefer the configured public base. */
export function publicWebhookUrl(req: Request, env: Record<string, string | undefined> = process.env): string {
  const u = new URL(req.url);
  const base = (env.TWILIO_WEBHOOK_BASE?.trim() || env.APP_BASE_URL?.trim() || "").replace(/\/$/, "");
  return base ? `${base}${u.pathname}${u.search}` : req.url;
}

export async function readForm(req: Request): Promise<FormParams> {
  const form = await req.formData();
  const out: FormParams = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string") continue;
    const cur = out[k];
    out[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v];
  }
  return out;
}

export interface TwilioInbound {
  /** MessageSid: Twilio retries a failed webhook with the same one, so it is the dedupe key */
  id: string;
  /** sender digits with country code */
  from: string;
  text: string | null;
  media: { url: string; type: string } | null;
  profileName: string | null;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Pull the owner's message out of Twilio's form fields. Anything that is not a WhatsApp message returns null. */
export function parseInbound(p: FormParams): TwilioInbound | null {
  const id = one(p.MessageSid) ?? one(p.SmsMessageSid);
  const fromRaw = one(p.From);
  if (!id || !fromRaw || !/^whatsapp:/i.test(fromRaw)) return null;
  const from = normalizePhone(fromRaw);
  if (!from) return null;
  const body = (one(p.Body) ?? "").trim();
  const n = Number(one(p.NumMedia) ?? 0);
  const url = n > 0 ? one(p.MediaUrl0) : undefined;
  const type = (one(p.MediaContentType0) ?? "").toLowerCase();
  return { id, from, text: body || null, media: url ? { url, type } : null, profileName: one(p.ProfileName) ?? null };
}

export interface TwilioStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  code: number | null;
  detail: string | null;
}

/** Status callback fields → one update. queued/sending/accepted carry no news (we already wrote "sending"). */
export function parseStatus(p: FormParams): TwilioStatus | null {
  const id = one(p.MessageSid) ?? one(p.SmsSid);
  const raw = (one(p.MessageStatus) ?? one(p.SmsStatus) ?? "").toLowerCase();
  if (!id) return null;
  const status = raw === "sent" || raw === "delivered" || raw === "read" ? raw : raw === "failed" || raw === "undelivered" ? "failed" : null;
  if (!status) return null;
  const code = Number(one(p.ErrorCode));
  return { id, status, code: Number.isFinite(code) && code > 0 ? code : null, detail: one(p.ChannelStatusMessage) ?? null };
}
