/**
 * PRD B8.5 recommendation engine. Detectors return facts + impact; ranking is impact × confidence,
 * with vendor bills due within settings.recommendations.pinDueDays pinned first.
 * Numbers come from code only (the LLM may rephrase but never calculates). All thresholds are merchant settings.
 */
import type { Snapshot } from "../domain";
import { byId, mean, sum } from "../domain";
import { addDays, istDayKey } from "../time";
import { rupees } from "../format";
import { projectCashFlow, openPayables, type CashFlow } from "./cashflow";
import { forecastAll, type ItemForecast } from "./forecast";
import { festivalPlan, makeUplift } from "./festival";
import { khataOverview, type KhataOverview } from "./khata-risk";
import { checkLoan } from "./loan";
import { dailyRevenue, dailyUnits } from "./series";

export type RecModule = "inventory" | "vendors" | "khata" | "growth";
export type RecType =
  | "REORDER"
  | "ADD_LOST_DEMAND_ITEM"
  | "DEAD_STOCK_CLEAR"
  | "OVERSTOCK"
  | "VENDOR_SWITCH"
  | "PAYABLE_DUE"
  | "PRICE_HIKE"
  | "STOP_CREDIT"
  | "COLLECT_DUES"
  | "RAISE_LIMIT"
  | "FESTIVAL_STOCKUP"
  | "CASH_SHORTFALL"
  | "INCREASE_UPI_SHARE"
  | "LOW_MARGIN"
  | "LOAN_FOR_FESTIVAL";

export interface Recommendation {
  id: string;
  module: RecModule;
  type: RecType;
  title: string;
  /** every number the owner will see, already formatted by code */
  facts: Record<string, string | number>;
  impactPaise: number;
  /** 0..1 */
  confidence: number;
  actionKey?: string;
  pinned: boolean;
  score: number;
}

type Draft = Omit<Recommendation, "pinned" | "score"> & { pinned?: boolean };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const f1 = (x: number) => Math.round(x * 10) / 10;

export interface RecContext {
  forecasts: ItemForecast[];
  khata: KhataOverview;
  cash: CashFlow;
}

/** Primary supplier = the vendor with the most purchase lines for the product. */
export function primaryVendors(snap: Snapshot): Map<string, string> {
  const pv = new Map(snap.purchases.map((p) => [p.id, p.vendorId]));
  const counts = new Map<string, Map<string, number>>();
  for (const it of snap.purchaseItems) {
    const v = pv.get(it.purchaseId);
    if (!v) continue;
    const m = counts.get(it.productId) ?? new Map<string, number>();
    m.set(v, (m.get(v) ?? 0) + 1);
    counts.set(it.productId, m);
  }
  const out = new Map<string, string>();
  for (const [pid, m] of counts) out.set(pid, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return out;
}

export function buildContext(snap: Snapshot): RecContext {
  const forecasts = forecastAll(snap, makeUplift(snap));
  const khata = khataOverview(snap);
  const cash = projectCashFlow(snap, { khata: khata.accounts });
  return { forecasts, khata, cash };
}

export function detectRecommendations(snap: Snapshot, ctx: RecContext = buildContext(snap)): Recommendation[] {
  const cfg = snap.settings.recommendations;
  const inv = snap.settings.inventory;
  const products = byId(snap.products);
  const vendors = byId(snap.vendors);
  const units = dailyUnits(snap, 120);
  const monthlyUnits = (pid: string) => sum((units.byProduct.get(pid) ?? []).slice(-30));
  const margin = (pid: string) => {
    const p = products.get(pid);
    return p ? p.pricePaise - p.costPaise : 0;
  };
  const drafts: Draft[] = [];

  // ---------- Inventory ----------
  const weekAgo = addDays(snap.now, -7);
  const lostBy = new Map<string, number>();
  for (const l of snap.lostDemand) if (l.createdAt >= weekAgo) lostBy.set(l.productId, (lostBy.get(l.productId) ?? 0) + l.qty);

  for (const f of ctx.forecasts) {
    const p = products.get(f.productId)!;
    const daily = mean(f.daily.slice(0, 7).map((d) => d.yhat));
    if ((f.status === "stockout" || f.status === "reorder") && f.suggestedOrderQty > 0) {
      const target = f.leadTimeDays + inv.reviewBufferDays;
      const uncovered = Math.max(0, target - f.daysToStockout);
      const lost = lostBy.get(f.productId) ?? 0;
      const forecastImpact = daily * uncovered * margin(f.productId);
      const lostImpact = lost * 4 * margin(f.productId);
      drafts.push({
        id: `REORDER:${f.productId}`,
        module: "inventory",
        type: "REORDER",
        title: f.status === "stockout" ? `${p.name} khatam hai — abhi order karo` : `${p.name} jaldi khatam hoga — order karo`,
        facts: {
          item: p.name,
          stock: f.stock,
          daysLeft: f1(f.daysToStockout),
          dailySales: f1(daily),
          orderQty: f.suggestedOrderQty,
          leadTimeDays: f.leadTimeDays,
          ...(lost ? { lostRequestsThisWeek: lost } : {}),
        },
        impactPaise: Math.round(Math.max(forecastImpact, lostImpact)),
        confidence: f.status === "stockout" ? 0.9 : clamp(1 - f.wape, 0.4, 0.95),
        actionKey: `create_po:${f.productId}:${f.suggestedOrderQty}`,
      });
    }
    if (f.status === "dead") {
      const value = f.stock * p.costPaise;
      drafts.push({
        id: `DEAD_STOCK_CLEAR:${f.productId}`,
        module: "inventory",
        type: "DEAD_STOCK_CLEAR",
        title: `${p.name} ${inv.deadStockDays}+ din se nahi bika — discount lagakar nikalo`,
        facts: { item: p.name, stock: f.stock, valueAtCost: rupees(value), deadStockDays: inv.deadStockDays },
        impactPaise: Math.round(value * cfg.deadStockRecovery),
        confidence: 0.6,
        actionKey: `clear_stock:${f.productId}`,
      });
    }
    if (f.status === "overstock") {
      const m = mean(f.daily.slice(0, 14).map((d) => d.yhat));
      const excess = Math.max(0, f.stock - m * cfg.overstockTargetDays);
      if (excess > 0)
        drafts.push({
          id: `OVERSTOCK:${f.productId}`,
          module: "inventory",
          type: "OVERSTOCK",
          title: `${p.name} zyada stock hai — naya order mat do`,
          facts: { item: p.name, stock: f.stock, coverDays: Math.round(f.coverDays), excessUnits: Math.round(excess), excessValue: rupees(Math.round(excess * p.costPaise)) },
          impactPaise: Math.round(excess * p.costPaise * cfg.overstockCarry),
          confidence: 0.5,
        });
    }
  }

  // Items customers ask for that the shop does not actively stock/buy.
  const everBought = new Set(snap.purchaseItems.map((i) => i.productId));
  for (const [pid, qty] of lostBy) {
    const p = products.get(pid);
    if (!p || (p.isActive && everBought.has(pid))) continue;
    drafts.push({
      id: `ADD_LOST_DEMAND_ITEM:${pid}`,
      module: "inventory",
      type: "ADD_LOST_DEMAND_ITEM",
      title: `${p.name} ke liye customers pooch rahe hain — rakhna shuru karo`,
      facts: { item: p.name, requestsThisWeek: qty },
      impactPaise: Math.round(qty * 4 * margin(pid)),
      confidence: 0.55,
    });
  }

  // ---------- Vendors ----------
  const primary = primaryVendors(snap);
  const vpByProduct = new Map<string, typeof snap.vendorProducts>();
  for (const vp of snap.vendorProducts) vpByProduct.set(vp.productId, [...(vpByProduct.get(vp.productId) ?? []), vp]);

  for (const [pid, list] of vpByProduct) {
    const p = products.get(pid);
    if (!p) continue;
    const mine = list.find((x) => x.vendorId === primary.get(pid)) ?? list[0];
    const mu = monthlyUnits(pid);
    if (mine.prevCostPaise && mine.prevCostPaise > 0) {
      const pct = (mine.lastCostPaise / mine.prevCostPaise - 1) * 100;
      if (pct >= cfg.priceHikePct)
        drafts.push({
          id: `PRICE_HIKE:${pid}`,
          module: "vendors",
          type: "PRICE_HIKE",
          title: `${vendors.get(mine.vendorId)?.name ?? "Vendor"} ne ${p.name} ka rate ${Math.round(pct)}% badhaya`,
          facts: { item: p.name, vendor: vendors.get(mine.vendorId)?.name ?? "", oldCost: rupees(mine.prevCostPaise), newCost: rupees(mine.lastCostPaise), hikePct: Math.round(pct) },
          impactPaise: Math.round(mu * (mine.lastCostPaise - mine.prevCostPaise)),
          confidence: 0.9,
        });
    }
    const cheaper = list
      .filter((x) => x.vendorId !== mine.vendorId && x.lastCostPaise < mine.lastCostPaise)
      .sort((a, b) => a.lastCostPaise - b.lastCostPaise)[0];
    if (cheaper) {
      const pct = (1 - cheaper.lastCostPaise / mine.lastCostPaise) * 100;
      if (pct >= cfg.vendorSwitchPct)
        drafts.push({
          id: `VENDOR_SWITCH:${pid}`,
          module: "vendors",
          type: "VENDOR_SWITCH",
          title: `${p.name} ${vendors.get(cheaper.vendorId)?.name ?? "dusre vendor"} se ${Math.round(pct)}% sasta milta hai`,
          facts: {
            item: p.name,
            from: vendors.get(mine.vendorId)?.name ?? "",
            to: vendors.get(cheaper.vendorId)?.name ?? "",
            currentCost: rupees(mine.lastCostPaise),
            cheaperCost: rupees(cheaper.lastCostPaise),
            savingPct: Math.round(pct),
            monthlyUnits: mu,
          },
          impactPaise: Math.round(mu * (mine.lastCostPaise - cheaper.lastCostPaise)),
          confidence: 0.7,
        });
    }
  }

  const payables = openPayables(snap);
  for (const b of payables.filter((x) => x.dueInDays <= cfg.pinDueDays))
    drafts.push({
      id: `PAYABLE_DUE:${b.purchaseId}`,
      module: "vendors",
      type: "PAYABLE_DUE",
      title: b.dueInDays < 0 ? `${b.vendorName} ka payment ${-b.dueInDays} din late hai` : `${b.vendorName} ka ${rupees(b.amountPaise)} ${b.dueInDays === 0 ? "aaj" : `${b.dueInDays} din mein`} due hai`,
      facts: { vendor: b.vendorName, amount: rupees(b.amountPaise), dueDate: b.dueDate, dueInDays: b.dueInDays },
      impactPaise: b.amountPaise,
      confidence: 1,
      actionKey: `pay_vendor:${b.purchaseId}`,
      pinned: true,
    });

  // ---------- Khata ----------
  const since90 = addDays(snap.now, -90);
  for (const a of ctx.khata.accounts) {
    if (a.band === "red" && !a.creditBlocked) {
      const monthlyCredit = sum(snap.khata.filter((k) => k.customerId === a.customerId && k.type === "credit" && k.createdAt >= since90).map((k) => k.amountPaise)) / 3;
      drafts.push({
        id: `STOP_CREDIT:${a.customerId}`,
        module: "khata",
        type: "STOP_CREDIT",
        title: `${a.name} ko naya udhaar band karo`,
        facts: { customer: a.name, outstanding: rupees(a.outstandingPaise), oldestDays: a.oldestUnpaidDays, score: a.score, reasons: a.reasons.join("; ") },
        impactPaise: Math.round(monthlyCredit),
        confidence: 0.8,
        actionKey: `block_credit:${a.customerId}`,
      });
    }
    if (a.band !== "green" || a.oldestUnpaidDays > 15)
      drafts.push({
        id: `COLLECT_DUES:${a.customerId}`,
        module: "khata",
        type: "COLLECT_DUES",
        title: `${a.name} se ${rupees(a.outstandingPaise)} wasool karo`,
        facts: { customer: a.name, outstanding: rupees(a.outstandingPaise), oldestDays: a.oldestUnpaidDays, band: a.emoji },
        impactPaise: a.expectedRecoveryPaise,
        confidence: 0.7,
        actionKey: `draft_reminder:${a.customerId}`,
      });
    if (a.band === "green" && a.suggestedLimitPaise > a.creditLimitPaise && a.repayRatio90 >= 0.8 && a.utilization >= 0.5)
      drafts.push({
        id: `RAISE_LIMIT:${a.customerId}`,
        module: "khata",
        type: "RAISE_LIMIT",
        title: `${a.name} bharosemand hai — limit badha sakte ho`,
        facts: { customer: a.name, currentLimit: rupees(a.creditLimitPaise), suggestedLimit: rupees(a.suggestedLimitPaise) },
        impactPaise: Math.round((a.suggestedLimitPaise - a.creditLimitPaise) * 0.2),
        confidence: 0.5,
        actionKey: `set_limit:${a.customerId}:${a.suggestedLimitPaise}`,
      });
  }

  // ---------- Growth & Finance ----------
  const plans = festivalPlan(snap, 45).filter((p) => p.items.length);
  for (const plan of plans) {
    const top = plan.items.slice(0, 3);
    const lead = Math.max(...plan.items.slice(0, 3).map((i) => ctx.forecasts.find((f) => f.productId === i.productId)?.leadTimeDays ?? 2));
    const orderBy = istDayKey(addDays(snap.now, plan.festival.daysAway - 7 - lead));
    const learned = plan.items.some((i) => i.learned);
    drafts.push({
      id: `FESTIVAL_STOCKUP:${plan.festival.name}`,
      module: "growth",
      type: "FESTIVAL_STOCKUP",
      title: `${plan.festival.name} ke liye stock plan: ${top.map((i) => i.name).join(", ")}`,
      facts: { festival: plan.festival.name, date: plan.festival.date, daysAway: plan.festival.daysAway, orderBy, topItems: top.map((i) => `${i.name} +${i.extraUnits}`).join("; ") },
      impactPaise: plan.totalImpactPaise,
      confidence: learned ? 0.6 : 0.4,
      actionKey: `festival_po:${plan.festival.name}`,
    });
  }

  const worst = ctx.cash.warnings.length ? ctx.cash.warnings.reduce((a, b) => (b.shortfallPaise > a.shortfallPaise ? b : a)) : null;
  if (worst)
    drafts.push({
      id: `CASH_SHORTFALL:${worst.date}`,
      module: "growth",
      type: "CASH_SHORTFALL",
      title: `${worst.date} tak ${rupees(worst.shortfallPaise)} kam pad sakta hai (${worst.vendorName} ka payment)`,
      facts: { date: worst.date, vendor: worst.vendorName, payable: rupees(worst.payablePaise), shortfall: rupees(worst.shortfallPaise), suggestion: worst.suggestions[0]?.text ?? "" },
      impactPaise: worst.shortfallPaise,
      confidence: 0.7,
    });

  const rev = dailyRevenue(snap, 30);
  const total30 = sum(rev.net);
  const cash30 = sum(rev.cash);
  if (total30 > 0 && cash30 / total30 > cfg.cashShareMax)
    drafts.push({
      id: "INCREASE_UPI_SHARE",
      module: "growth",
      type: "INCREASE_UPI_SHARE",
      title: "Cash sales UPI mein lo — hisaab aur loan eligibility dono behtar",
      facts: { cashSharePct: Math.round((cash30 / total30) * 100), thresholdPct: Math.round(cfg.cashShareMax * 100) },
      impactPaise: Math.round(cash30 * 0.01),
      confidence: 0.5,
    });

  for (const p of snap.products) {
    if (!p.isActive || p.pricePaise <= 0) continue;
    const mPct = ((p.pricePaise - p.costPaise) / p.pricePaise) * 100;
    const mu = monthlyUnits(p.id);
    if (mPct >= cfg.lowMarginPct || mu < 10) continue;
    const gain = mu * ((p.pricePaise * cfg.lowMarginPct) / 100 - (p.pricePaise - p.costPaise));
    drafts.push({
      id: `LOW_MARGIN:${p.id}`,
      module: "growth",
      type: "LOW_MARGIN",
      title: `${p.name} par margin sirf ${f1(mPct)}% hai`,
      facts: { item: p.name, marginPct: f1(mPct), targetPct: cfg.lowMarginPct, monthlyUnits: mu },
      impactPaise: Math.round(gain),
      confidence: 0.6,
    });
  }

  const loan = checkLoan(snap);
  if (loan.eligible && plans.length) {
    const plan = plans[0];
    const cost = sum(plan.items.map((i) => i.extraUnits * (products.get(i.productId)?.costPaise ?? 0)));
    const surplus = ctx.cash.series.length ? ctx.cash.series[ctx.cash.series.length - 1].cumulativePaise : 0;
    if (cost > Math.max(0, surplus))
      drafts.push({
        id: `LOAN_FOR_FESTIVAL:${plan.festival.name}`,
        module: "growth",
        type: "LOAN_FOR_FESTIVAL",
        title: `${plan.festival.name} stock ke liye short-term loan ka option dekh sakte ho (indicative)`,
        facts: { festival: plan.festival.name, stockCost: rupees(cost), indicativeMax: rupees(loan.indicativeMaxPaise), lender: loan.lenderName },
        impactPaise: Math.round(plan.totalImpactPaise),
        confidence: 0.4,
      });
  }

  return rank(drafts);
}

export function rank(drafts: Draft[]): Recommendation[] {
  const recs: Recommendation[] = drafts.map((d) => ({
    ...d,
    pinned: d.pinned ?? false,
    score: Math.max(0, d.impactPaise) * d.confidence,
  }));
  return recs.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned && b.pinned) return (a.facts.dueInDays as number) - (b.facts.dueInDays as number) || b.impactPaise - a.impactPaise;
    return b.score - a.score;
  });
}

export function topRecommendations(snap: Snapshot, n?: number, ctx?: RecContext): Recommendation[] {
  return detectRecommendations(snap, ctx).slice(0, n ?? snap.settings.recommendations.maxItems);
}
