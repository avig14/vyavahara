/**
 * PRD B12 report builder. ONE source for WhatsApp text, PDF and dashboard: identical numbers everywhere.
 * Pure function of a Snapshot + Period. Money in paise; the AI never computes any of this.
 */
import type { Snapshot } from "../domain";
import { byId, sum } from "../domain";
import { istDayKey, istHour, istWeekday, resolvePeriod, dayKeysBetween, addDays, type Period, type PeriodName } from "../time";
import { detectAnomalies, type Anomaly } from "../analytics/anomalies";
import { openPayables, type Payable } from "../analytics/cashflow";
import type { ItemForecast } from "../analytics/forecast";
import type { KhataAccount } from "../analytics/khata-risk";
import { buildContext, detectRecommendations, type RecContext, type Recommendation } from "../analytics/recommendations";

export interface TopItem {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  revenuePaise: number;
  profitPaise: number;
}

export interface ReportData {
  merchantName: string;
  period: { name: PeriodName; label: string; from: string; to: string; fromDay: string; toDay: string };
  generatedAt: string;
  sales: {
    totalPaise: number;
    upiPaise: number;
    cashPaise: number;
    refundsPaise: number;
    bills: number;
    avgBillPaise: number;
    prevTotalPaise: number;
    /** % change vs the previous equivalent period; null if there is no previous data */
    changePct: number | null;
  };
  profit: { grossPaise: number; expensesPaise: number; netPaise: number };
  topByRevenue: TopItem[];
  topByProfit: TopItem[];
  lostSales: { totalPaise: number; requests: number; top: { name: string; requests: number } | null };
  stockAlerts: { runningOut: ItemForecast[]; out: ItemForecast[]; dead: ItemForecast[] };
  khata: {
    totalDuePaise: number;
    collectedPaise: number;
    red: Pick<KhataAccount, "customerId" | "name" | "outstandingPaise" | "oldestUnpaidDays">[];
  };
  payablesDue: Payable[];
  anomalies: Anomaly[];
  recommendations: Recommendation[];
  /** one point per IST day in the period, for the bar chart */
  daily: { day: string; totalPaise: number }[];
}

export interface BuildOpts {
  period?: PeriodName;
  custom?: { from: Date; to: Date };
  /** pre-computed forecasts/khata/cash to avoid recomputing (dashboard builds several reports) */
  ctx?: RecContext;
  topN?: number;
  recs?: number;
  /** payables due within this many days are listed */
  payablesWithinDays?: number;
}

const signed = (kind: string, amt: number) => (kind === "refund" ? -amt : amt);

export function buildReport(snap: Snapshot, opts: BuildOpts = {}): ReportData {
  const period: Period = resolvePeriod(opts.period ?? "today", snap.now, opts.custom);
  const topN = opts.topN ?? 5;
  const inP = (d: Date) => d >= period.from && d < period.to;
  const inPrev = (d: Date) => d >= period.prevFrom && d < period.prevTo;
  const ctx = opts.ctx ?? buildContext(snap);

  // ----- sales -----
  let total = 0, upi = 0, cash = 0, refunds = 0, bills = 0, prevTotal = 0;
  const perDay = new Map<string, number>();
  for (const t of snap.transactions) {
    if (inPrev(t.createdAt)) prevTotal += signed(t.kind, t.amountPaise);
    if (!inP(t.createdAt)) continue;
    const v = signed(t.kind, t.amountPaise);
    total += v;
    if (t.kind === "refund") refunds += t.amountPaise;
    else bills++;
    if (t.method === "upi") upi += v;
    else cash += v;
    const k = istDayKey(t.createdAt);
    perDay.set(k, (perDay.get(k) ?? 0) + v);
  }

  // ----- profit & top items -----
  const products = byId(snap.products);
  const items = new Map<string, TopItem>();
  let gross = 0;
  for (const si of snap.saleItems) {
    if (!inP(si.createdAt)) continue;
    const p = products.get(si.productId);
    const rev = Math.round(si.qty * si.unitPricePaise);
    const profit = Math.round(si.qty * (si.unitPricePaise - si.unitCostPaise));
    gross += profit;
    const cur = items.get(si.productId) ?? { productId: si.productId, name: p?.name ?? "Item", unit: p?.unit ?? "", qty: 0, revenuePaise: 0, profitPaise: 0 };
    cur.qty += si.qty;
    cur.revenuePaise += rev;
    cur.profitPaise += profit;
    items.set(si.productId, cur);
  }
  const all = [...items.values()];
  const expenses = sum(snap.expenses.filter((e) => inP(e.createdAt)).map((e) => e.amountPaise));

  // ----- lost sales -----
  const lostBy = new Map<string, number>();
  let lostValue = 0, lostReq = 0;
  for (const l of snap.lostDemand) {
    if (!inP(l.createdAt)) continue;
    lostValue += l.estValuePaise;
    lostReq += l.qty;
    lostBy.set(l.productId, (lostBy.get(l.productId) ?? 0) + l.qty);
  }
  const topLost = [...lostBy.entries()].sort((a, b) => b[1] - a[1])[0];

  // ----- khata -----
  const collected = sum(snap.khata.filter((k) => k.type === "payment" && inP(k.createdAt)).map((k) => k.amountPaise));

  // ----- today-only: anomalies compare "today so far" -----
  const includesNow = period.to.getTime() >= snap.now.getTime() - 60_000 && period.from <= snap.now;
  const anomalies = includesNow ? detectAnomalies(snap) : [];

  const within = opts.payablesWithinDays ?? 7;
  const fromDay = istDayKey(period.from);
  const toDay = istDayKey(new Date(period.to.getTime() - 1));
  const daily = dayKeysBetween(fromDay, toDay).map((day) => ({ day, totalPaise: perDay.get(day) ?? 0 }));

  return {
    merchantName: snap.merchant.name,
    period: { name: period.name, label: period.label, from: period.from.toISOString(), to: period.to.toISOString(), fromDay, toDay },
    generatedAt: snap.now.toISOString(),
    sales: {
      totalPaise: total,
      upiPaise: upi,
      cashPaise: cash,
      refundsPaise: refunds,
      bills,
      avgBillPaise: bills ? Math.round((total + refunds) / bills) : 0,
      prevTotalPaise: prevTotal,
      changePct: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
    },
    profit: { grossPaise: gross, expensesPaise: expenses, netPaise: gross - expenses },
    topByRevenue: [...all].sort((a, b) => b.revenuePaise - a.revenuePaise).slice(0, topN),
    topByProfit: [...all].sort((a, b) => b.profitPaise - a.profitPaise).slice(0, topN),
    lostSales: {
      totalPaise: lostValue,
      requests: lostReq,
      top: topLost ? { name: products.get(topLost[0])?.name ?? "Item", requests: topLost[1] } : null,
    },
    stockAlerts: {
      out: ctx.forecasts.filter((f) => f.status === "stockout"),
      runningOut: ctx.forecasts.filter((f) => f.status === "reorder").sort((a, b) => a.daysToStockout - b.daysToStockout),
      dead: ctx.forecasts.filter((f) => f.status === "dead"),
    },
    khata: {
      totalDuePaise: ctx.khata.totalOutstandingPaise,
      collectedPaise: collected,
      red: ctx.khata.accounts
        .filter((a) => a.band === "red")
        .map((a) => ({ customerId: a.customerId, name: a.name, outstandingPaise: a.outstandingPaise, oldestUnpaidDays: a.oldestUnpaidDays })),
    },
    payablesDue: openPayables(snap).filter((p) => p.dueInDays <= within).sort((a, b) => a.dueInDays - b.dueInDays),
    anomalies,
    recommendations: detectRecommendations(snap, ctx).slice(0, opts.recs ?? 3),
    daily,
  };
}

/* ---------------- peak hours & days (PRD: hour × weekday heatmap) ---------------- */

export interface Heatmap {
  /** cells[weekday 0=Sun..6][hour 0..23] = total paise over `days` */
  cells: number[][];
  days: number;
  peakHour: number | null;
  peakWeekday: number | null;
  /** morning (5–12) vs evening (16–22) share, for "shaam ko zyada sale hoti hai ya subah?" */
  morningPaise: number;
  eveningPaise: number;
}

export function salesHeatmap(snap: Snapshot, days = 56): Heatmap {
  const since = addDays(snap.now, -days);
  const cells = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const byHour = new Array<number>(24).fill(0);
  const byDay = new Array<number>(7).fill(0);
  for (const t of snap.transactions) {
    if (t.createdAt < since || t.createdAt > snap.now) continue;
    const v = signed(t.kind, t.amountPaise);
    const h = istHour(t.createdAt);
    const w = istWeekday(t.createdAt);
    cells[w][h] += v;
    byHour[h] += v;
    byDay[w] += v;
  }
  const argmax = (xs: number[]) => (Math.max(...xs) > 0 ? xs.indexOf(Math.max(...xs)) : null);
  return {
    cells,
    days,
    peakHour: argmax(byHour),
    peakWeekday: argmax(byDay),
    morningPaise: sum(byHour.slice(5, 12)),
    eveningPaise: sum(byHour.slice(16, 22)),
  };
}
