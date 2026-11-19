import { getCtx, handle, json } from "@/lib/server/http";
import { loadSnapshot } from "@/lib/db/queries";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Demo "Connect Paytm Business": the seeded merchant is the one account. Returns what the onboarding page shows next. */
export const POST = () =>
  handle(async () => {
    const c = await getCtx();
    const snap = await loadSnapshot(c.db, c.merchantId, { now: c.now, historyDays: 1 });
    const m = snap.merchant;
    return json({ connected: true, merchant: { name: m.name, ownerName: m.ownerName, city: m.city ?? null, upiId: m.upiId ?? null } });
  });
