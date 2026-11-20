/**
 * WhatsApp reports for Growth and Insights: sales, customers, vendors, recommendations.
 * Pure: every number comes from the same analytics the dashboard and PDF use (buildReport, khataOverview,
 * segmentCustomers, openPayables, detectRecommendations). The AI writes none of it.
 */
import type { Snapshot } from "../domain";
import { buildReport } from "../reports/build";
import { buildContext, detectRecommendations, type RecContext, type RecModule, type Recommendation } from "../analytics/recommendations";
import { khataOverview } from "../analytics/khata-risk";
import { segmentCustomers } from "../analytics/segments";
import { openPayables } from "../analytics/cashflow";
import type { PeriodName } from "../time";
import { num, rupees } from "../format";

export type ReportKind = "daily" | "sales" | "customers" | "vendors" | "recommendations";
export const REPORT_KINDS: readonly ReportKind[] = ["daily", "sales", "customers", "vendors", "recommendations"];
export const REPORT_PERIODS: readonly PeriodName[] = ["today", "this_week", "this_month"];

const MINUS = "−";
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? MINUS : "");
const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const FOOT = "_Menu ke liye *Hi* likhiye_";

/** The same report without its closing line, for the menu tree (it adds its own back/menu footer). */
export const withoutFoot = (text: string): string => text.replace(`

${FOOT}`, "").replace(FOOT, "").trimEnd();

/* ---------------- sales ---------------- */

export function salesReportText(snap: Snapshot, period: PeriodName = "today", ctx?: RecContext): string {
  const r = buildReport(snap, { period, ctx: ctx ?? buildContext(snap), topN: 5 });
  const L: string[] = [`💰 *Sales report: ${r.period.label}*`, r.merchantName, ""];
  const s = r.sales;
  L.push(`Kul sale *${rupees(s.totalPaise)}* · ${s.bills} bills · average bill ${rupees(s.avgBillPaise)}`);
  if (s.totalPaise > 0) L.push(`UPI ${rupees(s.upiPaise)} (${share(s.upiPaise, s.totalPaise)}%) · Cash ${rupees(s.cashPaise)} (${share(s.cashPaise, s.totalPaise)}%)`);
  if (s.refundsPaise > 0) L.push(`Refund ${rupees(s.refundsPaise)}`);
  if (s.changePct !== null) L.push(`${s.changePct < 0 ? "📉" : "📈"} Pichli period se *${sign(s.changePct)}${Math.abs(s.changePct)}%* (pehle ${rupees(s.prevTotalPaise)})`);

  L.push("", "*Munafa*", `Gross ${rupees(r.profit.grossPaise)} · Kharcha ${rupees(r.profit.expensesPaise)} · *Net ${rupees(r.profit.netPaise)}*`);

  const days = r.daily.filter((d) => d.totalPaise > 0);
  if (days.length > 1) {
    const best = [...days].sort((a, b) => b.totalPaise - a.totalPaise)[0];
    const worst = [...days].sort((a, b) => a.totalPaise - b.totalPaise)[0];
    const name = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    L.push("", `📅 Sabse acha din ${name(best.day)} (${rupees(best.totalPaise)}) · sabse kam ${name(worst.day)} (${rupees(worst.totalPaise)})`);
  }

  if (r.topByRevenue.length) {
    L.push("", "*🏆 Sabse zyada bika*");
    r.topByRevenue.forEach((t, i) => L.push(`${i + 1}. ${t.name}: ${rupees(t.revenuePaise)} (${num(t.qty, t.qty % 1 ? 1 : 0)}${t.unit && t.unit !== "pc" ? ` ${t.unit}` : ""})`));
  }
  if (r.topByProfit.length) L.push("", `*💵 Sabse zyada munafa:* ${r.topByProfit.slice(0, 3).map((t) => `${t.name} ${rupees(t.profitPaise)}`).join(" · ")}`);
  if (r.lostSales.requests > 0) L.push("", `❌ Lost sales ${rupees(r.lostSales.totalPaise)}${r.lostSales.top ? `: ${r.lostSales.top.requests} log ${r.lostSales.top.name} maang ke gaye` : ""}`);
  // "sales are 100% below normal" is just noise before the first sale of the day, and the line below already says so
  const noSalesYet = s.bills === 0;
  for (const a of r.anomalies.filter((x) => !(noSalesYet && x.kind === "sales_dip")).slice(0, 2)) L.push(`⚠️ ${a.text}`);
  if (noSalesYet) L.push("", period === "today" ? "Aaj abhi koi sale nahi hui. Is hafte ka dekhne ke liye *Hi* → *4* → *2* bhejiye." : "Is period mein koi sale nahi hui.");
  L.push("", FOOT);
  return L.join("\n");
}

/* ---------------- customers ---------------- */

export function customerReportText(snap: Snapshot): string {
  const seg = segmentCustomers(snap);
  const kh = khataOverview(snap);
  const total = seg.customers.length;
  const L: string[] = [`👥 *Customer report*`, snap.merchant.name, ""];
  if (!total) L.push("Abhi customer ke bills record mein nahi hain.");
  else {
    L.push(`Kul ${total} customers: ${seg.counts.regular} regular · ${seg.counts.new} naye · ${seg.counts.occasional} kabhi-kabhi · ${seg.counts.lapsed} laut ke nahi aaye`);
    const top = [...seg.customers].sort((a, b) => b.spend30Paise - a.spend30Paise).filter((c) => c.spend30Paise > 0).slice(0, 3);
    if (top.length) {
      L.push("", "*🏆 Is mahine sabse zyada kharch*");
      top.forEach((c, i) => L.push(`${i + 1}. ${c.name}: ${rupees(c.spend30Paise)} (${c.visits30} baar aaye)`));
    }
    if (seg.lapsed.length) {
      L.push("", "*💤 Wapas bulane layak* (pehle regular the)");
      seg.lapsed.slice(0, 3).forEach((c) => L.push(`• ${c.name}: ${c.lastVisitDaysAgo ?? "?"} din se nahi aaye (kul kharch ${rupees(c.lifetimePaise)})`));
      if (seg.lapsed.length > 3) L.push(`• +${seg.lapsed.length - 3} aur`);
    }
  }
  if (kh.totalOutstandingPaise > 0) {
    L.push("", `*📒 Udhaar baaki ${rupees(kh.totalOutstandingPaise)}*`);
    const b = kh.byBand;
    L.push(`🔴 ${b.red.count} (${rupees(b.red.outstandingPaise)}) · 🟡 ${b.amber.count} (${rupees(b.amber.outstandingPaise)}) · 🟢 ${b.green.count} (${rupees(b.green.outstandingPaise)})`);
    kh.accounts.filter((a) => a.band === "red").slice(0, 3).forEach((a) => L.push(`🔴 ${a.name} ${rupees(a.outstandingPaise)}, ${a.oldestUnpaidDays} din se`));
    if (kh.ageing.d60p > 0) L.push(`60 din se purana: ${rupees(kh.ageing.d60p)}`);
  } else L.push("", "📒 Koi udhaar baaki nahi.");
  L.push("", FOOT);
  return L.join("\n");
}

/* ---------------- vendors ---------------- */

export function vendorReportText(snap: Snapshot, ctx?: RecContext): string {
  const pay = openPayables(snap);
  const L: string[] = [`🧾 *Supplier report*`, snap.merchant.name, ""];
  const totalDue = pay.reduce((t, p) => t + p.amountPaise, 0);
  const late = pay.filter((p) => p.dueInDays < 0);
  L.push(`${snap.vendors.length} suppliers · dena baaki *${rupees(totalDue)}*${late.length ? ` · ⚠️ ${late.length} late (${rupees(late.reduce((t, p) => t + p.amountPaise, 0))})` : ""}`);
  if (pay.length) {
    L.push("", "*Kisko kitna dena hai*");
    [...pay]
      .sort((a, b) => a.dueInDays - b.dueInDays)
      .slice(0, 6)
      .forEach((p) => L.push(`• ${p.vendorName} ${rupees(p.amountPaise)}: ${p.dueInDays < 0 ? `${-p.dueInDays} din late` : p.dueInDays === 0 ? "aaj due" : `${p.dueInDays} din mein due`}`));
    if (pay.length > 6) L.push(`• +${pay.length - 6} aur`);
  } else L.push("", "Koi supplier payment baaki nahi.");

  const products = new Map(snap.products.map((p) => [p.id, p.name]));
  const vendors = new Map(snap.vendors.map((v) => [v.id, v.name]));
  const moves = snap.vendorProducts
    .filter((x) => x.prevCostPaise && x.prevCostPaise !== x.lastCostPaise)
    .map((x) => ({ x, pct: Math.round(((x.lastCostPaise - (x.prevCostPaise as number)) / (x.prevCostPaise as number)) * 1000) / 10 }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 4);
  if (moves.length) {
    L.push("", "*📈 Rate badle*");
    for (const m of moves) L.push(`• ${products.get(m.x.productId) ?? "Item"} (${vendors.get(m.x.vendorId) ?? "supplier"}): ${rupees(m.x.prevCostPaise as number)} → ${rupees(m.x.lastCostPaise)} (${sign(m.pct)}${Math.abs(m.pct)}%)`);
  }

  const recs = detectRecommendations(snap, ctx ?? buildContext(snap)).filter((r) => r.module === "vendors" && r.type !== "PAYABLE_DUE").slice(0, 3); // dues are already listed above
  if (recs.length) L.push("", "*✅ Kya karein*", ...recs.map((r, i) => `${i + 1}. ${r.title}`));
  L.push("", FOOT);
  return L.join("\n");
}

/* ---------------- recommendations ---------------- */

const GROUPS: { module: RecModule; head: string }[] = [
  { module: "inventory", head: "📦 Stock" },
  { module: "vendors", head: "🧾 Suppliers" },
  { module: "khata", head: "📒 Udhaar" },
  { module: "growth", head: "📈 Growth" },
];

const confidenceWord = (c: number) => (c >= 0.8 ? "pakka" : c >= 0.5 ? "andaza" : "kam bharosa");

export function recommendationReportText(snap: Snapshot, ctx?: RecContext, perGroup = 2): string {
  const all = detectRecommendations(snap, ctx ?? buildContext(snap));
  const L: string[] = [`✅ *Suggestions report*`, snap.merchant.name, ""];
  if (!all.length) return [...L, "Abhi koi khaas suggestion nahi hai. Sab theek chal raha hai.", "", FOOT].join("\n");
  // no total: "impact" mixes money you could gain with money you owe, so adding it up would mislead
  L.push(`${all.length} suggestions, sabse zaroori pehle`);
  let n = 0;
  for (const g of GROUPS) {
    const rs: Recommendation[] = all.filter((r) => r.module === g.module).slice(0, perGroup);
    if (!rs.length) continue;
    L.push("", `*${g.head}*`);
    for (const r of rs) {
      n++;
      const tail = [r.impactPaise > 0 ? `≈ ${rupees(r.impactPaise)}` : "", confidenceWord(r.confidence)].filter(Boolean).join(" · ");
      L.push(`${n}. ${r.title} _(${tail})_`);
    }
  }
  const more = all.length - n;
  if (more > 0) L.push("", `_…aur ${more} suggestions dashboard par_`);
  L.push("", "_Andaza purane sales aur stock par based hai; faisla aapka._", FOOT);
  return L.join("\n");
}

/* ---------------- one entry point ---------------- */

export function reportTextFor(snap: Snapshot, kind: Exclude<ReportKind, "daily">, period: PeriodName = "today"): string {
  const ctx = buildContext(snap);
  if (kind === "sales") return salesReportText(snap, period, ctx);
  if (kind === "customers") return customerReportText(snap);
  if (kind === "vendors") return vendorReportText(snap, ctx);
  return recommendationReportText(snap, ctx);
}
