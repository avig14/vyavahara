/**
 * Meta WhatsApp Cloud API client: direct Graph API calls, no SDK, no third party.
 * Server only. The token never leaves the server and is never logged.
 * Docs: POST /{PHONE_NUMBER_ID}/messages, Bearer token, `messaging_product: "whatsapp"`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Matches the version in Meta's current Cloud API examples; override with WHATSAPP_API_VERSION. */
export const DEFAULT_API_VERSION = "v27.0";
/** WhatsApp text limit is 4096 characters; stay under it so a long report is split on a line break instead of rejected. */
export const MAX_TEXT = 3800;

export interface WaConfig {
  token: string;
  phoneNumberId: string;
  version: string;
}

export function waConfig(env: Record<string, string | undefined> = process.env): WaConfig | null {
  const token = env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId, version: env.WHATSAPP_API_VERSION?.trim() || DEFAULT_API_VERSION };
}

/* ---------- errors, in words the owner can act on ---------- */

export type WaErrorKind = "window" | "not_allowed" | "token" | "rate" | "bad_number" | "other";

export class WaError extends Error {
  constructor(
    message: string,
    readonly kind: WaErrorKind,
    readonly code: number | null,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "WaError";
  }
}

export function classify(code: number | null, httpStatus: number): { kind: WaErrorKind; message: string } {
  if (code === 131047 || code === 131051) return { kind: "window", message: "24 ghante se zyada ho gaye. WhatsApp par us number se ek baar 'Hi' bhejo, phir dobara try karo." };
  if (code === 131030) return { kind: "not_allowed", message: "Yeh number test list mein nahi hai. Meta dashboard > WhatsApp > API Setup mein number add karke verify karo." };
  if (code === 190 || httpStatus === 401) return { kind: "token", message: "WhatsApp access token expire ho gaya ya galat hai. Naya token .env mein daalo." };
  if (code === 130429 || code === 131056 || code === 80007) return { kind: "rate", message: "Bahut zyada messages gaye. Thodi der baad try karo." };
  if (code === 131026 || code === 1013 || code === 100) return { kind: "bad_number", message: "Yeh number WhatsApp par nahi mila ya galat hai. Number check karo." };
  return { kind: "other", message: "WhatsApp message nahi ja paya. Thodi der baad dobara try karo." };
}

/* ---------- phone numbers ---------- */

/**
 * Cloud API wants the number as digits with country code and no "+" (e.g. 919876543210).
 * A bare 10-digit Indian mobile gets 91. Anything that cannot be a phone number returns null.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) d = `91${d}`;
  if (d.length < 11 || d.length > 15) return null;
  return d;
}

/** "91••••••3210": enough for the owner to recognise it, never the whole number. */
export const maskPhone = (digits: string) => (digits.length <= 6 ? digits : `${digits.slice(0, 2)}${"•".repeat(digits.length - 6)}${digits.slice(-4)}`);

/* ---------- long messages ---------- */

/** Split on line breaks so no chunk passes `max`; a single over-long line is cut hard. */
export function splitMessage(text: string, max = MAX_TEXT): string[] {
  const out: string[] = [];
  let cur = "";
  const push = () => {
    if (cur) out.push(cur);
    cur = "";
  };
  for (const line of text.split("\n")) {
    if (line.length > max) {
      push();
      for (let i = 0; i < line.length; i += max) out.push(line.slice(i, i + max));
      continue;
    }
    if (cur && cur.length + 1 + line.length > max) push();
    cur = cur ? `${cur}\n${line}` : line;
  }
  push();
  return out;
}

/* ---------- send ---------- */

type Fetch = typeof fetch;

async function post(cfg: WaConfig, body: Record<string, unknown>, f: Fetch): Promise<{ wamid: string }> {
  let res: Response;
  try {
    res = await f(`https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new WaError("WhatsApp tak pahunch nahi paye. Internet check karo.", "other", null, 0);
  }
  const data = (await res.json().catch(() => null)) as { messages?: { id?: string }[]; error?: { code?: number; message?: string } } | null;
  if (!res.ok || !data?.messages?.[0]?.id) {
    const code = typeof data?.error?.code === "number" ? data.error.code : null;
    const c = classify(code, res.status);
    // the raw Meta message can carry the number or token detail: keep it out of logs
    console.error("[wa] send failed", { httpStatus: res.status, code });
    throw new WaError(c.message, c.kind, code, res.status);
  }
  return { wamid: data.messages[0].id };
}

export const sendText = (to: string, body: string, cfg: WaConfig, f: Fetch = fetch) => post(cfg, { to, type: "text", text: { preview_url: false, body } }, f);

/** `hello_world` (en_US) is pre-approved on every test number: the only message allowed outside the 24-hour window. */
export const sendTemplate = (to: string, cfg: WaConfig, name = "hello_world", language = "en_US", f: Fetch = fetch) =>
  post(cfg, { to, type: "template", template: { name, language: { code: language } } }, f);

/** Several chunks in order. Returns the id of the last one (the one whose status the dashboard tracks). */
export async function sendLongText(to: string, text: string, cfg: WaConfig, f: Fetch = fetch): Promise<{ wamid: string; parts: number }> {
  const parts = splitMessage(text);
  let wamid = "";
  for (const p of parts) wamid = (await sendText(to, p, cfg, f)).wamid;
  return { wamid, parts: parts.length };
}

/* ---------- webhook ---------- */

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(raw body, app secret). Compared in constant time. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const want = createHmac("sha256", appSecret).update(rawBody).digest();
  const got = Buffer.from(header.slice(7), "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

export interface InboundMessage {
  id: string;
  from: string;
  type: string;
  text: string | null;
  /** interactive replies carry the chosen id/title here */
  reply: string | null;
}
export interface StatusUpdate {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  code: number | null;
  detail: string | null;
}

/** Pull messages and status updates out of a webhook POST. Anything unexpected is skipped, never thrown. */
export function parseWebhook(body: unknown): { messages: InboundMessage[]; statuses: StatusUpdate[] } {
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const entries = (body as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return { messages, statuses };
  for (const e of entries) {
    const changes = (e as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const ch of changes) {
      const v = (ch as { value?: Record<string, unknown> })?.value;
      if (!v) continue;
      for (const m of Array.isArray(v.messages) ? (v.messages as Record<string, unknown>[]) : []) {
        if (typeof m.id !== "string" || typeof m.from !== "string") continue;
        const type = typeof m.type === "string" ? m.type : "unknown";
        const text = type === "text" ? ((m.text as { body?: string } | undefined)?.body ?? null) : null;
        const ir = m.interactive as { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } } | undefined;
        const r = ir?.button_reply ?? ir?.list_reply;
        messages.push({ id: m.id, from: m.from, type, text, reply: r ? (r.id ?? r.title ?? null) : null });
      }
      for (const st of Array.isArray(v.statuses) ? (v.statuses as Record<string, unknown>[]) : []) {
        const s = st.status;
        if (typeof st.id !== "string" || (s !== "sent" && s !== "delivered" && s !== "read" && s !== "failed")) continue;
        const err = Array.isArray(st.errors) ? (st.errors[0] as { code?: number; title?: string; message?: string } | undefined) : undefined;
        statuses.push({ id: st.id, status: s, code: typeof err?.code === "number" ? err.code : null, detail: err ? (err.title ?? err.message ?? null) : null });
      }
    }
  }
  return { messages, statuses };
}
