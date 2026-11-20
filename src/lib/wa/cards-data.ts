/**
 * Data for the photo cards sent with WhatsApp replies (the layouts live in cards.tsx, drawn after assets/social).
 * Pure: every figure comes from the same snapshot analytics as the dashboard. The wording of the drafted messages is fixed.
 */
import type { Snapshot } from "../domain";
import { buildContext, primaryVendors, type RecContext } from "../analytics/recommendations";
import { buildReport } from "../reports/build";
import { khataOverview } from "../analytics/khata-risk";
import { addDays, istDayKey } from "../time";
import { num, rupees } from "../format";

export type CardKind = "daily" | "udhaar" | "stock";
export const CARD_KINDS: readonly CardKind[] = ["daily", "udhaar", "stock"];

const clock = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const dateLabel = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/* ---------------- daily ---------------- */

export interface DailyCardData {
  /** "Aaj", "Kal" or a date: the day the figures are for */
  dayLabel: string;
  title: string;
  totalPaise: number;
  upiPaise: number;
  cashPaise: number;
  bills: number;
  rows: { time: string; items: string; by: "UPI" | "Cash" | "Card"; amountPaise: number }[];
  udhaarPaise: number;
  lowStock: number;
}

/** Today's figures; before the first sale of the day, the latest day in the last week that had sales (labelled as such). */
export function dailyCardData(snap: Snapshot, ctx: RecContext = buildContext(snap)): DailyCardData {
  const sales = snap.transactions.filter((t) => t.kind === "sale");
  let day = istDayKey(snap.now);
  let dayLabel = "Aaj";
  let title = "Aaj ka hisaab";
  if (!sales.some((t) => istDayKey(t.createdAt) === day)) {
    for (let back = 1; back <= 7; back++) {
      const d = addDays(snap.now, -back);
      if (sales.some((t) => istDayKey(t.createdAt) === istDayKey(d))) {
        day = istDayKey(d);
        dayLabel = back === 1 ? "Kal" : dateLabel(d);
        title = back === 1 ? "Kal ka hisaab" : `${dateLabel(d)} ka hisaab`;
        break;
      }
    }
  }
  const mine = sales.filter((t) => istDayKey(t.createdAt) === day).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const names = new Map(snap.products.map((p) => [p.id, p.name]));
  const itemsBy = new Map<string, string[]>();
  for (const si of snap.saleItems) {
    const n = names.get(si.productId);
    if (n) itemsBy.set(si.transactionId, [...(itemsBy.get(si.transactionId) ?? []), n]);
  }
  const itemText = (id: string) => {
    const xs = itemsBy.get(id) ?? [];
    return xs.length === 0 ? "Sale" : xs.length === 1 ? xs[0] : `${xs[0]} +${xs.length - 1}`;
  };
  const by = (m: string): "UPI" | "Cash" | "Card" => (m === "upi" ? "UPI" : m === "cash" ? "Cash" : "Card");
  const sum = (f: (t: (typeof mine)[number]) => boolean) => mine.filter(f).reduce((s, t) => s + t.amountPaise, 0);
  return {
    dayLabel,
    title,
    totalPaise: sum(() => true),
    upiPaise: sum((t) => t.method === "upi"),
    cashPaise: sum((t) => t.method === "cash"),
    bills: mine.length,
    rows: mine.slice(0, 5).map((t) => ({ time: clock(t.createdAt), items: itemText(t.id), by: by(t.method), amountPaise: t.amountPaise })),
    udhaarPaise: ctx.khata.totalOutstandingPaise,
    lowStock: ctx.forecasts.filter((f) => f.status === "stockout" || f.status === "reorder").length,
  };
}

/* ---------------- udhaar ---------------- */

export interface UdhaarCardData {
  none: boolean;
  shop: string;
  customer: string;
  amountPaise: number;
  days: number;
  draft: string;
}

/** The customer most worth a reminder: red first, then the oldest unpaid. */
export function udhaarCardData(snap: Snapshot): UdhaarCardData {
  const accts = khataOverview(snap).accounts.filter((a) => a.outstandingPaise > 0);
  const rank = (b: string) => (b === "red" ? 0 : b === "amber" ? 1 : 2);
  const a = [...accts].sort((x, y) => rank(x.band) - rank(y.band) || y.oldestUnpaidDays - x.oldestUnpaidDays || y.outstandingPaise - x.outstandingPaise)[0];
  const shop = snap.merchant.name;
  if (!a) return { none: true, shop, customer: "", amountPaise: 0, days: 0, draft: "" };
  return {
    none: false,
    shop,
    customer: a.name,
    amountPaise: a.outstandingPaise,
    days: a.oldestUnpaidDays,
    draft: `Namaste ${a.name}, ${shop} se. Aapka ${rupees(a.outstandingPaise)} ka udhaar ${a.oldestUnpaidDays} din se baaki hai. Jab ho sake, UPI kar dijiye. Dhanyavaad!`,
  };
}

/* ---------------- stock ---------------- */

export interface StockCardData {
  none: boolean;
  /** nothing left at all */
  out: boolean;
  item: string;
  /** "2 kg" */
  left: string;
  /** 0..100, how much of a safe level is left */
  meter: number;
  supplier: string;
  qty: string;
  draft: string;
}

export function stockCardData(snap: Snapshot, ctx: RecContext = buildContext(snap)): StockCardData {
  const f = ctx.forecasts.filter((x) => x.status === "stockout" || x.status === "reorder").sort((a, b) => a.daysToStockout - b.daysToStockout || b.suggestedOrderQty - a.suggestedOrderQty)[0];
  if (!f) return { none: true, out: false, item: "", left: "", meter: 100, supplier: "", qty: "", draft: "" };
  const product = snap.products.find((p) => p.id === f.productId);
  const unit = product && product.unit !== "pc" ? ` ${product.unit}` : "";
  const vendorId = primaryVendors(snap).get(f.productId);
  const supplier = snap.vendors.find((v) => v.id === vendorId)?.name ?? "supplier ji";
  const left = `${num(f.stock, f.stock % 1 ? 1 : 0)}${unit}`;
  const qty = f.suggestedOrderQty > 0 ? `${num(f.suggestedOrderQty, f.suggestedOrderQty % 1 ? 1 : 0)}${unit}` : "thoda";
  return {
    none: false,
    out: f.stock <= 0,
    item: f.name,
    left,
    meter: f.stock <= 0 ? 0 : Math.max(4, Math.min(100, Math.round((f.stock / Math.max(1, f.reorderPoint * 2)) * 100))),
    supplier,
    qty,
    draft: `Namaste ${supplier}, ${f.name} ${qty} bhej dijiye. Dhanyavaad!`,
  };
}

/** Which card, if any, a reply carries (the preview and the real bot share this). */
export const cardUrlFor = (kind: CardKind, v: number | string = Date.now()) => `/api/wa/card/${kind}?v=${v}`;

/** One cheap builder for tests and the route. */
export function buildCardData(snap: Snapshot, kind: CardKind) {
  const ctx = buildContext(snap);
  if (kind === "daily") return dailyCardData(snap, ctx);
  if (kind === "udhaar") return udhaarCardData(snap);
  return stockCardData(snap, ctx);
}

/** The report the daily card sits next to must agree with it: used by tests. */
export const dailyReportTotal = (snap: Snapshot) => buildReport(snap, { period: "today" }).sales.totalPaise;
