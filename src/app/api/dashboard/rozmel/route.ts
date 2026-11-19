import { getCtx, handle, json, HttpError } from "@/lib/server/http";
import { loadSnapshot } from "@/lib/db/queries";
import { addDays, istDayKey, istDayStart } from "@/lib/time";
import { byId } from "@/lib/domain";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * The rozmel: one IST day of receipts in time order, with the running total after each line.
 * `?day=YYYY-MM-DD` (default today IST). Refunds count negative. Items appear only where a sale was matched to products.
 */
export const GET = (req: Request) =>
  handle(async () => {
    const c = await getCtx();
    const raw = new URL(req.url).searchParams.get("day");
    if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new HttpError(400, "day must be YYYY-MM-DD");
    const day = raw ?? istDayKey(c.now);
    const from = istDayStart(day);
    const to = addDays(from, 1);

    const snap = await loadSnapshot(c.db, c.merchantId, { now: c.now });
    const products = byId(snap.products);
    const customers = byId(snap.customers);
    const items = new Map<string, typeof snap.saleItems>();
    for (const si of snap.saleItems) items.set(si.transactionId, [...(items.get(si.transactionId) ?? []), si]);

    const todays = snap.transactions
      .filter((t) => t.createdAt >= from && t.createdAt < to)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let running = 0;
    const rows = todays.map((t) => {
      const signed = t.kind === "refund" ? -t.amountPaise : t.amountPaise;
      running += signed;
      const lines = (items.get(t.id) ?? []).map((si) => ({
        name: products.get(si.productId)?.name ?? "Unknown item",
        qty: si.qty,
        unitPricePaise: si.unitPricePaise,
        confidence: si.confidence,
      }));
      return {
        id: t.id,
        at: t.createdAt.toISOString(),
        amountPaise: signed,
        kind: t.kind,
        method: t.method,
        source: t.source,
        utr: t.utr,
        payer: t.customerId ? (customers.get(t.customerId)?.name ?? null) : null,
        items: lines,
        runningTotalPaise: running,
      };
    });

    return json({ day, count: rows.length, totalPaise: running, rows });
  });
