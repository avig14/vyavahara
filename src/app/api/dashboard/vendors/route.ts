import { getCtx, handle, json } from "@/lib/server/http";
import { loadDash } from "@/lib/server/dash";
import { listPurchaseOrders } from "@/lib/db/queries";
import { openPayables } from "@/lib/analytics/cashflow";

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = () =>
  handle(async () => {
    const c = await getCtx();
    const d = await loadDash(c);
    const priceChanges = d.snap.vendorProducts
      .filter((x) => x.prevCostPaise && x.prevCostPaise !== x.lastCostPaise)
      .map((x) => ({ ...x, changePct: Math.round(((x.lastCostPaise - (x.prevCostPaise as number)) / (x.prevCostPaise as number)) * 1000) / 10 }))
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
    return json({
      vendors: d.snap.vendors,
      payables: openPayables(d.snap),
      priceChanges,
      purchaseOrders: await listPurchaseOrders(c.db, c.merchantId),
      recommendations: d.recs.filter((r) => r.module === "vendors"),
    });
  });
