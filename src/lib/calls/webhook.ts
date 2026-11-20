/** Shared helpers for the Vobiz webhook routes. */
import { timingSafeEqual } from "node:crypto";

/** Vobiz posts form or JSON (the docs do not say which, so accept both). */
export async function readParams(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("json")) {
      const j = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) if (v != null && typeof v !== "object") out[k] = String(v);
    } else {
      const text = await req.text();
      for (const [k, v] of new URLSearchParams(text)) out[k] = v;
    }
  } catch {
    /* empty body is fine */
  }
  return out;
}

const eq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Webhooks carry ?k=<VOBIZ_WEBHOOK_SECRET>. Vobiz documents no request signature, so this shared secret in the URL is our check. */
export function webhookAuthorized(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.VOBIZ_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const k = new URL(req.url).searchParams.get("k") ?? "";
  return eq(k, secret);
}

/** The cron / manual trigger sends `Authorization: Bearer <CALLS_CRON_SECRET>`. */
export function cronAuthorized(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.CALLS_CRON_SECRET?.trim();
  if (!secret) return false;
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") && eq(h.slice(7), secret);
}

export function publicBase(env: Record<string, string | undefined> = process.env): string {
  return (env.APP_BASE_URL ?? "").replace(/\/$/, "");
}
