/** PRD B8.2 / B8.3: store revenue forecast and 14-day cash-flow projection with shortfall warnings. Pure. */
import type { Expense, Purchase, Snapshot } from "../domain";
import { mean, sum, byId } from "../domain";
import { addDays, dayKeysBetween, istDayKey, istDayStart, istDom, istDaysBetween, startOfIstDay } from "../time";
import { rupees } from "../format";
import { holtWinters, seasonalNaive } from "./forecast";
import { dailyRevenue } from "./series";
import { khataOverview, type KhataAccount } from "./khata-risk";


export interface RevenuePoint {
  date: string;
  totalPaise: number;
  upiPaise: number;
  cashPaise: number;
}

/** Holt-Winters on daily net sales, 14 days from tomorrow, UPI/cash split by trailing-30-day ratio. */
export function forecastRevenue(snap: Snapshot, horizon = snap.settings.inventory.horizonDays): RevenuePoint[] {
  const r = dailyRevenue(snap, 120);
  const total30 = sum(r.net.slice(-30));
  const upiShare = total30 > 0 ? sum(r.upi.slice(-30)) / total30 : 0.7;
  const fc = r.net.length >= 28 ? holtWinters(r.net, horizon + 1, 0) : seasonalNaive(r.net, horizon + 1);
  // fc[0] is today (partial day, handled separately); fc[1..] are tomorrow onward
  const start = istDayStart(istDayKey(addDays(snap.now, 1)));
  return Array.from({ length: horizon }, (_, i) => {
    const total = Math.max(0, Math.round(fc[i + 1]));
    const upi = Math.round(total * upiShare);
    return { date: istDayKey(addDays(start, i)), totalPaise: total, upiPaise: upi, cashPaise: total - upi };
  });
}

export interface Payable {
  purchaseId: string;
  vendorId: string;
  vendorName: string;
  invoiceNo: string | null;
  dueDate: string;
  /** days from today, negative when overdue */
  dueInDays: number;
  amountPaise: number;
  status: Purchase["status"];
}

/** Open vendor bills. Partial bills: total minus later payments to that vendor (capped at 0). */
export function openPayables(snap: Snapshot): Payable[] {
  const vendors = byId(snap.vendors);
  const today = startOfIstDay(snap.now);
  const out: Payable[] = [];
  for (const p of snap.purchases) {
    if (p.status === "paid") continue;
    let amount = p.totalPaise;
    if (p.status === "partial") {
      const paid = sum(
        snap.vendorPayments
          .filter((v) => v.vendorId === p.vendorId && istDayKey(v.createdAt) >= p.invoiceDate)
          .map((v) => v.amountPaise),
      );
      amount = Math.max(0, p.totalPaise - paid);
    }
    if (amount <= 0) continue;
    out.push({
      purchaseId: p.id,
      vendorId: p.vendorId,
      vendorName: vendors.get(p.vendorId)?.name ?? "Vendor",
      invoiceNo: p.invoiceNo,
      dueDate: p.dueDate,
      dueInDays: istDaysBetween(today, istDayStart(p.dueDate)),
      amountPaise: amount,
      status: p.status,
    });
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.amountPaise - a.amountPaise);
}

export interface RecurringExpense {
  category: Expense["category"];
  label?: string;
  dayOfMonth: number;
  amountPaise: number;
}

/** Rent / salary / electricity: latest amount and the day-of-month it was booked. */
export function recurringExpenses(snap: Snapshot): RecurringExpense[] {
  const custom = snap.settings.cash.recurring;
  if (custom)
    return custom.map((c) => ({ category: "other" as const, label: c.label, dayOfMonth: c.dayOfMonth, amountPaise: c.amountPaise }));
  const out: RecurringExpense[] = [];
  for (const cat of ["rent", "salary", "electricity"] as const) {
    const rows = snap.expenses.filter((e) => e.category === cat);
    if (!rows.length) continue;
    const last = rows.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    out.push({ category: cat, dayOfMonth: istDom(last.createdAt), amountPaise: last.amountPaise });
  }
  return out;
}

export interface CashDay {
  date: string;
  inflowSalesPaise: number;
  inflowCollectionsPaise: number;
  outflowPayablesPaise: number;
  outflowExpensesPaise: number;
  netPaise: number;
  /** running balance from the opening position (0 unless supplied) */
  cumulativePaise: number;
}

export interface CashSuggestion {
  kind: "collect" | "delay" | "split";
  text: string;
  amountPaise: number;
  ref?: string;
}

export interface CashWarning {
  date: string;
  dueInDays: number;
  vendorId: string;
  vendorName: string;
  purchaseId: string;
  payablePaise: number;
  shortfallPaise: number;
  suggestions: CashSuggestion[];
}

export interface CashFlow {
  series: CashDay[];
  warnings: CashWarning[];
  totalInflowPaise: number;
  totalOutflowPaise: number;
  /** expected rupees from khata over the horizon (Σ outstanding × p_band, collected evenly over 14 days) */
  collectionsPaise: number;
  payables: Payable[];
  revenue: RevenuePoint[];
}

/**
 * inflow[d]  = salesForecast[d] + Σ outstanding × p_band / 14
 * outflow[d] = payables due on d (overdue → tomorrow) + recurring expenses booked on d
 * A warning fires on a payable's due date when the running balance through that day is negative.
 */
export function projectCashFlow(snap: Snapshot, opts: { openingPaise?: number; horizon?: number; khata?: KhataAccount[] } = {}): CashFlow {
  const cfg = snap.settings.cash;
  const horizon = opts.horizon ?? snap.settings.inventory.horizonDays;
  const revenue = forecastRevenue(snap, horizon);
  const accounts = opts.khata ?? khataOverview(snap).accounts;
  const collectionsPerDay = sum(accounts.map((a) => (a.outstandingPaise * snap.settings.khata.recovery[a.band]) / cfg.collectionDays));
  const payables = openPayables(snap);
  const recurring = recurringExpenses(snap);
  const keys = revenue.map((r) => r.date);
  const first = keys[0];

  const payByDay = new Map<string, number>();
  for (const p of payables) {
    const day = p.dueDate < first ? first : p.dueDate;
    payByDay.set(day, (payByDay.get(day) ?? 0) + p.amountPaise);
  }

  let running = opts.openingPaise ?? cfg.openingBalancePaise;
  const series: CashDay[] = revenue.map((r) => {
    const dom = istDom(istDayStart(r.date));
    const exp = sum(recurring.filter((x) => x.dayOfMonth === dom).map((x) => x.amountPaise));
    const pay = payByDay.get(r.date) ?? 0;
    const coll = Math.round(collectionsPerDay);
    const net = r.totalPaise + coll - pay - exp;
    running += net;
    return {
      date: r.date,
      inflowSalesPaise: r.totalPaise,
      inflowCollectionsPaise: coll,
      outflowPayablesPaise: pay,
      outflowExpensesPaise: exp,
      netPaise: net,
      cumulativePaise: running,
    };
  });

  const idx = new Map(series.map((d, i) => [d.date, i]));
  const warnings: CashWarning[] = [];
  const warned = new Set<string>(); // one warning per due date: attribute it to the largest bill that day
  for (const p of [...payables].sort((a, b) => b.amountPaise - a.amountPaise)) {
    const day = p.dueDate < first ? first : p.dueDate;
    const i = idx.get(day);
    if (i === undefined) continue;
    const bal = series[i].cumulativePaise;
    if (bal >= cfg.minBufferPaise || warned.has(day)) continue;
    warned.add(day);
    const shortfall = Math.min(cfg.minBufferPaise - bal, p.amountPaise);
    warnings.push({
      date: day,
      dueInDays: p.dueInDays,
      vendorId: p.vendorId,
      vendorName: p.vendorName,
      purchaseId: p.purchaseId,
      payablePaise: p.amountPaise,
      shortfallPaise: shortfall,
      suggestions: suggest(shortfall, p, accounts),
    });
  }

  warnings.sort((a, b) => a.date.localeCompare(b.date));
  return {
    series,
    warnings,
    totalInflowPaise: sum(series.map((d) => d.inflowSalesPaise + d.inflowCollectionsPaise)),
    totalOutflowPaise: sum(series.map((d) => d.outflowPayablesPaise + d.outflowExpensesPaise)),
    collectionsPaise: Math.round(collectionsPerDay * horizon),
    payables,
    revenue,
  };
}

function suggest(shortfall: number, p: Payable, accounts: KhataAccount[]): CashSuggestion[] {
  const out: CashSuggestion[] = [];
  const dues = accounts
    .filter((a) => a.outstandingPaise > 0)
    .sort((a, b) => b.outstandingPaise - a.outstandingPaise);
  let covered = 0;
  const names: string[] = [];
  for (const a of dues) {
    if (covered >= shortfall) break;
    covered += a.outstandingPaise;
    names.push(a.name);
    if (names.length === 3) break;
  }
  if (names.length)
    out.push({
      kind: "collect",
      text: `Udhaar wasool karo: ${names.join(", ")} se ${rupees(Math.min(covered, sum(dues.map((d) => d.outstandingPaise))))} aa sakta hai`,
      amountPaise: Math.min(covered, shortfall),
    });
  out.push({
    kind: "delay",
    text: `${p.vendorName} se ${rupees(shortfall)} ka payment 2-3 din aage karne ko bolo`,
    amountPaise: shortfall,
    ref: p.purchaseId,
  });
  out.push({
    kind: "split",
    text: `${rupees(p.amountPaise - shortfall)} abhi do, baaki ${rupees(shortfall)} baad mein`,
    amountPaise: shortfall,
    ref: p.purchaseId,
  });
  return out;
}

/** Cheap helpers used by the dashboard KPI row. */
export function dueSoon(flow: CashFlow, withinDays = 2): Payable[] {
  return flow.payables.filter((p) => p.dueInDays <= withinDays);
}

export function avgDailySales(snap: Snapshot, days = 30): number {
  return mean(dailyRevenue(snap, days).net);
}

export { dayKeysBetween };
