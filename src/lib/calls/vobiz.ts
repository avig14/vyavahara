/**
 * Vobiz (https://www.vobiz.ai/docs) voice client + VobizXML builder.
 * Auth: X-Auth-ID / X-Auth-Token. Outbound call: POST /api/v1/Account/{auth_id}/Call/ (capital A and C, trailing slash).
 */
export interface VobizConfig {
  authId: string;
  authToken: string;
  /** caller ID: a DID owned by the account, digits only (e.g. 918065551234) */
  from: string;
  baseUrl: string;
  /** "dry" = never call Vobiz, only log */
  mode: "live" | "dry";
}

export function vobizConfig(env: Record<string, string | undefined> = process.env): VobizConfig | null {
  const authId = env.VOBIZ_AUTH_ID?.trim();
  const authToken = env.VOBIZ_AUTH_TOKEN?.trim();
  const from = normalizeIndianPhone(env.VOBIZ_FROM_NUMBER ?? "");
  if (!authId || !authToken || !from) return null;
  return {
    authId,
    authToken,
    from,
    baseUrl: (env.VOBIZ_BASE_URL?.trim() || "https://api.vobiz.ai").replace(/\/$/, ""),
    mode: env.VOBIZ_SEND_MODE?.trim().toLowerCase() === "dry" ? "dry" : "live",
  };
}

/** "98765 43210", "+91 98765-43210", "09876543210" → "919876543210". null if it is not an Indian mobile number. */
export function normalizeIndianPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const ten = d.length === 10 ? d : d.length === 11 && d.startsWith("0") ? d.slice(1) : d.length === 12 && d.startsWith("91") ? d.slice(2) : null;
  return ten && /^[6-9]\d{9}$/.test(ten) ? `91${ten}` : null;
}

export interface PlaceCallInput {
  to: string;
  answerUrl: string;
  hangupUrl: string;
  /** seconds; reminder calls are short */
  timeLimit?: number;
  /** Vobiz answering-machine detection. Off by default: on a real test it hung up on a human (hangup_cause "Machine Detected"). */
  machineDetection?: boolean;
}

export type PlaceCallResult = { ok: true; callUuid: string; dry?: boolean } | { ok: false; status: number; error: string };

export async function placeCall(cfg: VobizConfig, input: PlaceCallInput, fetchImpl: typeof fetch = fetch): Promise<PlaceCallResult> {
  if (cfg.mode === "dry") {
    console.log("[vobiz dry] would call", input.to.replace(/\d(?=\d{4})/g, "x"));
    return { ok: true, callUuid: `dry-${Date.now()}`, dry: true };
  }
  const res = await fetchImpl(`${cfg.baseUrl}/api/v1/Account/${encodeURIComponent(cfg.authId)}/Call/`, {
    method: "POST",
    headers: { "X-Auth-ID": cfg.authId, "X-Auth-Token": cfg.authToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: cfg.from,
      to: input.to,
      answer_url: input.answerUrl,
      answer_method: "POST",
      hangup_url: input.hangupUrl,
      hangup_method: "POST",
      time_limit: String(input.timeLimit ?? 180),
      ...(input.machineDetection ? { machine_detection: "hangup" } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { request_uuid?: string; message?: string; error?: string };
  if (!res.ok || !body.request_uuid) return { ok: false, status: res.status, error: body.error ?? body.message ?? `HTTP ${res.status}` };
  return { ok: true, callUuid: body.request_uuid };
}

/* ---------- VobizXML ---------- */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const xml = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
export const speak = (text: string, language = "hi-IN") => `<Speak language="${esc(language)}">${esc(text)}</Speak>`;
export const hangup = () => "<Hangup/>";
export const gather = (action: string, prompt: string, language?: string, timeoutSec = 8) =>
  `<Gather action="${esc(action)}" method="POST" numDigits="1" executionTimeout="${timeoutSec}">${speak(prompt, language)}</Gather>`;
export const xmlResponse = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" } });
