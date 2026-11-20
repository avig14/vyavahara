import { getDb } from "@/lib/db/client";
import { loadSnapshot } from "@/lib/db/queries";
import { recentAttempts } from "@/lib/calls/store";
import { selectCallCandidates } from "@/lib/calls/select";
import { vobizConfig } from "@/lib/calls/vobiz";
import { dialTarget } from "@/lib/calls/dial";
import { cronAuthorized, publicBase } from "@/lib/calls/webhook";
import { getDefaultMerchantId } from "@/lib/db/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Call Saathi run: find customers whose udhaar is past the merchant's threshold and dial them.
 * `POST /api/calls/run` with `Authorization: Bearer $CALLS_CRON_SECRET`.
 * `?dry=1` only lists who WOULD be called (no DB rows, no calls). Trigger it from a Vercel Cron or by hand.
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: "DATABASE_URL is not set" }, { status: 503 });

  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const db = getDb();
  const merchantId = await getDefaultMerchantId(db);
  if (!merchantId) return Response.json({ error: "no merchant" }, { status: 404 });

  const now = new Date();
  const snap = await loadSnapshot(db, merchantId, { now });
  const { candidates, skipped } = selectCallCandidates(snap, await recentAttempts(db, merchantId, 90, now), now);
  const view = candidates.map((c) => ({ customer: c.name, amountPaise: c.amountPaise, overdueDays: c.overdueDays }));
  if (dry) return Response.json({ dry: true, enabled: snap.settings.calls.enabled, wouldCall: view, skipped: skipped.map((s) => ({ customer: s.name, reason: s.reason })) });

  const cfg = vobizConfig();
  const base = publicBase();
  const secret = process.env.VOBIZ_WEBHOOK_SECRET;
  if (!cfg || !base || !secret) return Response.json({ error: "Vobiz is not configured (VOBIZ_*, APP_BASE_URL)" }, { status: 503 });

  const results: { customer: string; ok: boolean; error?: string }[] = [];
  for (const c of candidates) {
    const r = await dialTarget(db, cfg, base, secret, merchantId, c);
    results.push({ customer: c.name, ok: r.ok, ...(r.ok ? {} : { error: r.error }) });
  }
  return Response.json({ placed: results.filter((r) => r.ok).length, results });
}
