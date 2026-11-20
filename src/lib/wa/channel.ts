/**
 * One way to talk to the owner, whichever WhatsApp provider is live. The router only knows `Channel`.
 *  - twilio: PRD-sanctioned sandbox/production path (preferred when configured)
 *  - meta:   Cloud API (text only here; kept so the Meta webhook keeps working)
 *  - dry:    records replies in memory, calls nobody. For tests, the simulator and rehearsals (TWILIO_SEND_MODE=dry)
 * `deliver` adds what every provider needs: chunking, a hard daily budget (the Twilio trial stops at 50), and a dashboard log row.
 */
import type { Db } from "../db/client";
import { countOutboundSince, markWaFailed, markWaSent, startWaMessage } from "../db/queries";
import { WaError, sendText as metaSendText, splitMessage, waConfig, type WaConfig } from "./cloud";
import { fetchTwilioMedia, sendTwilioMedia, sendTwilioText, twilioConfig, type TwilioConfig } from "./twilio";

export interface Channel {
  name: "twilio" | "meta" | "dry";
  /** Twilio: 1,600 chars per message, the PRD asks for ≤ 1,500. Meta: 4,096. */
  maxText: number;
  /** max messages we send in a rolling 24h (null = no cap of our own) */
  dailyCap: number | null;
  supportsMedia: boolean;
  sendText(to: string, body: string): Promise<string>;
  sendMedia(to: string, url: string): Promise<string>;
  fetchMedia(url: string): Promise<{ bytes: Uint8Array; mime: string }>;
}

export const TWILIO_MAX_TEXT = 1500;

type Fetch = typeof fetch;

/** Twilio only accepts a callback it can reach: https with a real host. */
export function statusCallbackUrl(env: Record<string, string | undefined> = process.env): string | null {
  const base = (env.APP_BASE_URL ?? "").trim().replace(/\/$/, "");
  return /^https:\/\/[^/]+\.[^/]+/.test(base) ? `${base}/api/twilio/status` : null;
}

export function twilioChannel(cfg: TwilioConfig, f: Fetch = fetch): Channel {
  const cb = statusCallbackUrl();
  return {
    name: "twilio",
    maxText: TWILIO_MAX_TEXT,
    dailyCap: cfg.dailyCap,
    supportsMedia: true,
    sendText: async (to, body) => (await sendTwilioText(cfg, to, body, { statusCallback: cb }, f)).sid,
    sendMedia: async (to, url) => (await sendTwilioMedia(cfg, to, url, { statusCallback: cb }, f)).sid,
    fetchMedia: (url) => fetchTwilioMedia(cfg, url, f),
  };
}

export function metaChannel(cfg: WaConfig, f: Fetch = fetch): Channel {
  return {
    name: "meta",
    maxText: 3800,
    dailyCap: null,
    supportsMedia: false,
    sendText: async (to, body) => (await metaSendText(to, body, cfg, f)).wamid,
    sendMedia: async () => {
      throw new WaError("Meta channel se file nahi bhej sakte.", "other", null, 0);
    },
    fetchMedia: async () => {
      throw new WaError("Meta channel se attachment download nahi hota.", "other", null, 0);
    },
  };
}

export interface Sent {
  to: string;
  kind: "text" | "media";
  body: string;
}

/** Records instead of sending. `media` lets tests hand the router a voice note / photo. */
export function dryChannel(outbox: Sent[] = [], media: Record<string, { bytes: Uint8Array; mime: string }> = {}): Channel & { outbox: Sent[] } {
  let n = 0;
  return {
    name: "dry",
    maxText: TWILIO_MAX_TEXT,
    dailyCap: null,
    supportsMedia: true,
    outbox,
    sendText: async (to, body) => {
      outbox.push({ to, kind: "text", body });
      return `dry-${++n}`;
    },
    sendMedia: async (to, url) => {
      outbox.push({ to, kind: "media", body: url });
      return `dry-${++n}`;
    },
    fetchMedia: async (url) => {
      const m = media[url];
      if (!m) throw new WaError("dry: media nahi mila", "other", null, 404);
      return m;
    },
  };
}

/** Twilio when its three env vars are set (dry if TWILIO_SEND_MODE=dry), else Meta, else null. */
export function pickChannel(env: Record<string, string | undefined> = process.env): Channel | null {
  const t = twilioConfig(env);
  if (t) return t.mode === "dry" ? dryChannel() : twilioChannel(t);
  const m = waConfig(env);
  return m ? metaChannel(m) : null;
}

/** Which provider the dashboard should describe. */
export const activeProvider = (env: Record<string, string | undefined> = process.env): "twilio" | "meta" | null => (twilioConfig(env) ? "twilio" : waConfig(env) ? "meta" : null);

/* ---------------- deliver ---------------- */

export type OutPart = { text: string } | { mediaUrl: string; label?: string };
export type OutKind = "report" | "template" | "reply" | "menu" | "alert" | "pdf";

export interface DeliverResult {
  sent: number;
  /** why the rest did not go (owner-readable), if anything failed */
  error: { message: string; code: number | null } | null;
}

/** 24h rolling window, as Twilio counts the trial cap. */
const DAY_MS = 86_400_000;

/**
 * Send parts in order, one log row each. Stops at the first failure so replies never arrive out of order.
 * Over the daily budget → nothing is sent and the row says why (better than Twilio's 63038 mid-conversation).
 */
export async function deliver(db: Db, ch: Channel, merchantId: string, to: string, parts: OutPart[], kind: OutKind, now = new Date()): Promise<DeliverResult> {
  // flatten: long text → several messages
  const msgs: OutPart[] = parts.flatMap((p): OutPart[] => ("text" in p ? splitMessage(p.text, ch.maxText).map((t) => ({ text: t })) : [p]));
  let sent = 0;
  let used = ch.dailyCap === null ? 0 : await countOutboundSince(db, merchantId, new Date(now.getTime() - DAY_MS));
  for (const m of msgs) {
    const preview = "text" in m ? m.text.split("\n")[0] : (m.label ?? "📎 PDF");
    const rowId = await startWaMessage(db, merchantId, kind, preview);
    if (ch.dailyCap !== null && used >= ch.dailyCap) {
      const msg = "Aaj ki WhatsApp message limit poori ho gayi (trial). Kal dobara try karo.";
      await markWaFailed(db, rowId, 63038, msg);
      return { sent, error: { message: msg, code: 63038 } };
    }
    try {
      const id = "text" in m ? await ch.sendText(to, m.text) : await ch.sendMedia(to, m.mediaUrl);
      await markWaSent(db, rowId, id);
      sent++;
      used++;
    } catch (e) {
      const err = e instanceof WaError ? e : null;
      await markWaFailed(db, rowId, err?.code ?? null, err?.message ?? "Unexpected error");
      return { sent, error: { message: err?.message ?? "Unexpected error", code: err?.code ?? null } };
    }
  }
  return { sent, error: null };
}

