/**
 * Best-effort fixed-window rate limit for public, credit-spending routes (Soundbox voice on the landing page).
 * In-memory per server instance: on serverless each warm instance counts separately, which is fine as a
 * brake against accidental or casual abuse. It is not a security boundary.
 */
const buckets = new Map<string, { start: number; count: number }>();
const MAX_KEYS = 5000;

export interface Limit {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function hit(key: string, max: number, windowMs: number, now = Date.now()): Limit {
  const b = buckets.get(key);
  if (!b || now - b.start >= windowMs) {
    if (buckets.size >= MAX_KEYS) buckets.delete(buckets.keys().next().value as string);
    buckets.set(key, { start: now, count: 1 });
    return { ok: true, remaining: max - 1, retryAfterSec: 0 };
  }
  b.count += 1;
  const ok = b.count <= max;
  return { ok, remaining: Math.max(0, max - b.count), retryAfterSec: ok ? 0 : Math.ceil((b.start + windowMs - now) / 1000) };
}

/** Caller IP from Vercel/proxy headers; "local" when there is none (dev). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** test helper */
export function resetRateLimits() {
  buckets.clear();
}
