/**
 * Small pure views shared by the agent tools and the WhatsApp menu, so "same question, same number" holds
 * whichever way the owner asks (menu digit, free text, dashboard).
 */
import { byId, type Snapshot, type Vendor } from "../domain";
import { resolvePeriod, type PeriodName } from "../time";
import { primaryVendors, type RecContext } from "./recommendations";
import type { ItemForecast } from "./forecast";

export interface ReorderLine {
  f: ItemForecast;
  vendor: Vendor | null;
}

/** Items to order now (stocked out or at reorder point) with their usual supplier. */
export function reorderLines(snap: Snapshot, ctx: RecContext, vendorName?: string): ReorderLine[] {
  const pv = primaryVendors(snap);
  const vendors = byId(snap.vendors);
  return ctx.forecasts
    .filter((f) => (f.status === "stockout" || f.status === "reorder") && f.suggestedOrderQty > 0)
    .map((f) => ({ f, vendor: vendors.get(pv.get(f.productId) ?? "") ?? null }))
    .filter((x) => !vendorName || x.vendor?.name.toLowerCase().includes(vendorName.toLowerCase()));
}

export interface LostSalesView {
  label: string;
  totalPaise: number;
  items: { productId: string; name: string; requests: number; valuePaise: number }[];
}

export function lostSalesView(snap: Snapshot, period: PeriodName = "last_7_days", custom?: { from: Date; to: Date }): LostSalesView {
  const p = resolvePeriod(period, snap.now, custom);
  const products = byId(snap.products);
  const by = new Map<string, { qty: number; value: number }>();
  for (const l of snap.lostDemand) {
    if (l.createdAt < p.from || l.createdAt >= p.to) continue;
    const c = by.get(l.productId) ?? { qty: 0, value: 0 };
    c.qty += l.qty;
    c.value += l.estValuePaise;
    by.set(l.productId, c);
  }
  const rows = [...by.entries()].sort((x, y) => y[1].value - x[1].value);
  return {
    label: p.label,
    totalPaise: rows.reduce((s, [, v]) => s + v.value, 0),
    items: rows.map(([id, v]) => ({ productId: id, name: products.get(id)?.name ?? "Item", requests: v.qty, valuePaise: v.value })),
  };
}

export interface PriceChange {
  item: string;
  vendor: string;
  fromPaise: number;
  toPaise: number;
  pct: number;
}

/** Vendor price moves versus the previous purchase, biggest first. */
export function priceChanges(snap: Snapshot): PriceChange[] {
  const products = byId(snap.products);
  const vendors = byId(snap.vendors);
  return snap.vendorProducts
    .filter((x) => x.prevCostPaise && x.prevCostPaise !== x.lastCostPaise)
    .map((x) => ({
      item: products.get(x.productId)?.name ?? "Item",
      vendor: vendors.get(x.vendorId)?.name ?? "",
      fromPaise: x.prevCostPaise as number,
      toPaise: x.lastCostPaise,
      pct: Math.round(((x.lastCostPaise - (x.prevCostPaise as number)) / (x.prevCostPaise as number)) * 1000) / 10,
    }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

export interface DeadStockView {
  totalStuckPaise: number;
  items: { productId: string; name: string; stock: number; unit: string; stuckPaise: number }[];
}

/** Items with no recent sales and the money (at cost) stuck in them. */
export function deadStockView(snap: Snapshot, ctx: RecContext): DeadStockView {
  const products = byId(snap.products);
  const items = ctx.forecasts
    .filter((f) => f.status === "dead")
    .map((f) => ({ productId: f.productId, name: f.name, stock: f.stock, unit: products.get(f.productId)?.unit ?? "", stuckPaise: Math.round(f.stock * (products.get(f.productId)?.costPaise ?? 0)) }))
    .sort((a, b) => b.stuckPaise - a.stuckPaise);
  return { totalStuckPaise: items.reduce((s, r) => s + r.stuckPaise, 0), items };
}
