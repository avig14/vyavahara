/**
 * The business analysis the owner reads on WhatsApp. Pure: every number comes from the same
 * buildReport the dashboard and PDF use, so the three always agree. Nothing is invented:
 * expiry dates are not tracked in this app, so there is no expiry section.
 */
import { buildReport, type ReportData } from "../reports/build";
import { buildContext, type RecContext } from "../analytics/recommendations";
import type { ItemForecast } from "../analytics/forecast";
import type { Snapshot } from "../domain";
import { daysLabel, num, rupees } from "../format";

const MINUS = "−";
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? MINUS : "");
const unitOf = (snap: Snapshot, id: string) => snap.products.find((p) => p.id === id)?.unit ?? "pc";
const qty = (snap: Snapshot, f: ItemForecast, n: number) => {
  const u = unitOf(snap, f.productId);
  return `${num(n, n % 1 ? 1 : 0)}${u === "pc" ? "" : ` ${u}`}`;
};
const names = (xs: ItemForecast[], max: number) => xs.slice(0, max).map((f) => f.name).join(", ") + (xs.length > max ? ` +${xs.length - max} aur` : "");

export interface Digest {
  text: string;
  /** which blocks made it in, for tests and the dashboard preview */
  sections: string[];
}

/**
 * Sales, trend, stock (order / piling up / not moving), money in and out, then what to do.
 * Sections with nothing to say are left out rather than padded.
 */
export function whatsappDigest(snap: Snapshot, opts: { ctx?: RecContext; today?: ReportData } = {}): Digest {
  const ctx = opts.ctx ?? buildContext(snap);
  const today = opts.today ?? buildReport(snap, { period: "today", ctx });
  const week = buildReport(snap, { period: "this_week", ctx });
  const sections: string[] = ["today"];
  const L: string[] = [`📊 *${today.period.label} ka report — ${today.merchantName}*`];

  // sales and trend
  const c = today.sales.changePct;
  L.push(`💰 Sales *${rupees(today.sales.totalPaise)}* (${today.sales.bills} bills) · UPI ${rupees(today.sales.upiPaise)} · Cash ${rupees(today.sales.cashPaise)}`);
  if (c !== null) L.push(`${c < 0 ? "📉" : "📈"} Pichle hafte ke same din se *${sign(c)}${Math.abs(c)}%*`);
  if (week.sales.totalPaise > 0) {
    const wc = week.sales.changePct;
    const best = [...week.daily].sort((a, b) => b.totalPaise - a.totalPaise)[0];
    const bestDay = best && best.totalPaise > 0 ? new Date(`${best.day}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }) : null;
    L.push(`📅 Is hafte ${rupees(week.sales.totalPaise)}${wc === null ? "" : ` (*${sign(wc)}${Math.abs(wc)}%* pichle hafte se)`}${bestDay ? ` · Sabse acha din ${bestDay}` : ""}`);
  }
  L.push(`💵 Gross profit ${rupees(today.profit.grossPaise)} · Kharcha ${rupees(today.profit.expensesPaise)} · *Net ${rupees(today.profit.netPaise)}*`);
  if (today.topByRevenue.length) L.push(`🏆 Top: ${today.topByRevenue.slice(0, 3).map((t) => t.name).join(" · ")}`);
  if (today.lostSales.requests > 0) L.push(`❌ Lost sales ${rupees(today.lostSales.totalPaise)}${today.lostSales.top ? ` — ${today.lostSales.top.requests} log ${today.lostSales.top.name} maang ke gaye` : ""}`);
  sections.push("sales");

  // stock: what to order, what is piling up, what is not moving
  const out = ctx.forecasts.filter((f) => f.status === "stockout");
  const reorder = ctx.forecasts.filter((f) => f.status === "reorder").sort((a, b) => a.daysToStockout - b.daysToStockout);
  const over = ctx.forecasts.filter((f) => f.status === "overstock").sort((a, b) => b.coverDays - a.coverDays);
  const dead = ctx.forecasts.filter((f) => f.status === "dead");
  const stock: string[] = [];
  if (out.length) stock.push(`🔴 Khatam: ${names(out, 4)}`);
  for (const f of reorder.slice(0, 4)) stock.push(`🟠 ${f.name} ~${daysLabel(f.daysToStockout)} ka bacha${f.suggestedOrderQty > 0 ? ` · ${qty(snap, f, f.suggestedOrderQty)} mangwao` : ""}`);
  if (reorder.length > 4) stock.push(`🟠 +${reorder.length - 4} aur items jaldi khatam honge`);
  if (over.length) stock.push(`🟡 Zyada stock: ${names(over, 3)}`);
  if (dead.length) stock.push(`⚪ Nahi bik raha: ${names(dead, 3)}`);
  if (stock.length) {
    L.push("", "*📦 Stock*", ...stock);
    sections.push("stock");
  }

  // money in and out
  const money: string[] = [];
  if (today.khata.totalDuePaise > 0) {
    money.push(`📒 Udhaar baaki ${rupees(today.khata.totalDuePaise)}`);
    for (const a of today.khata.red.slice(0, 2)) money.push(`🔴 ${a.name} ${rupees(a.outstandingPaise)} (${a.oldestUnpaidDays} din)`);
  }
  for (const p of today.payablesDue.slice(0, 3)) {
    const when = p.dueInDays < 0 ? `${-p.dueInDays} din late` : p.dueInDays === 0 ? "aaj due" : `${p.dueInDays} din mein due`;
    money.push(`🧾 ${p.vendorName} ${rupees(p.amountPaise)} — ${when}`);
  }
  if (money.length) {
    L.push("", "*💳 Lena-dena*", ...money);
    sections.push("money");
  }

  for (const a of today.anomalies.slice(0, 2)) L.push(`⚠️ ${a.text}`);

  // what to do
  if (today.recommendations.length) {
    L.push("", "*✅ Suggestions*", ...today.recommendations.slice(0, 4).map((r, i) => `${i + 1}. ${r.title}`));
    sections.push("recommendations");
  }
  L.push("", "_Menu ke liye *Hi* likhiye · PDF ke liye *PDF*_");
  return { text: L.join("\n"), sections };
}

/** Same blocks, but only the stock part (menu option 2). */
export function stockText(snap: Snapshot, ctx: RecContext = buildContext(snap)): string {
  const d = whatsappDigest(snap, { ctx });
  const i = d.text.indexOf("*📦 Stock*");
  if (i < 0) return "📦 Abhi koi item khatam ya jaldi khatam hone wala nahi hai.";
  const rest = d.text.slice(i);
  const end = rest.indexOf("\n\n");
  return end < 0 ? rest : rest.slice(0, end);
}
