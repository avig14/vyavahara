/** WhatsApp text for a ReportData (PRD B12). Pure formatting: every number comes from ReportData. */
import { rupees, daysLabel, num } from "../format";
import type { ReportData } from "./build";

const MINUS = "−";

function changeLine(r: ReportData): string | null {
  const c = r.sales.changePct;
  if (c === null) return null;
  const vs = r.period.name === "today" || r.period.name === "yesterday" ? "Pichle hafte ke same din se" : "Pichli period se";
  const sign = c > 0 ? "+" : c < 0 ? MINUS : "";
  return `${c < 0 ? "📉" : "📈"} ${vs} *${sign}${Math.abs(c)}%*`;
}

export function reportText(r: ReportData, opts: { footer?: boolean } = {}): string {
  const L: string[] = [];
  L.push(`📊 *${r.period.label} ka report — ${r.merchantName}*`);
  L.push(`💰 Sales *${rupees(r.sales.totalPaise)}* (${r.sales.bills} bills) · UPI ${rupees(r.sales.upiPaise)} · Cash ${rupees(r.sales.cashPaise)}`);
  const ch = changeLine(r);
  if (ch) L.push(ch);
  L.push(`💵 Gross profit ${rupees(r.profit.grossPaise)} · Kharcha ${rupees(r.profit.expensesPaise)} · *Net ${rupees(r.profit.netPaise)}*`);

  if (r.topByRevenue.length)
    L.push(`🏆 Top: ${r.topByRevenue.slice(0, 3).map((t) => `${t.name} (${num(t.qty, t.qty % 1 ? 1 : 0)}${t.unit && t.unit !== "pc" ? ` ${t.unit}` : ""})`).join(" · ")}`);

  if (r.lostSales.requests > 0)
    L.push(
      `❌ Lost sales ${rupees(r.lostSales.totalPaise)}` +
        (r.lostSales.top ? ` — ${r.lostSales.top.requests} log ${r.lostSales.top.name} maang ke gaye` : ""),
    );

  const soon = [...r.stockAlerts.out.map((f) => `${f.name} khatam`), ...r.stockAlerts.runningOut.slice(0, 3).map((f) => `${f.name} ~${daysLabel(f.daysToStockout)}`)];
  if (soon.length) L.push(`📦 Jaldi khatam: ${soon.slice(0, 4).join(" · ")}`);

  if (r.khata.totalDuePaise > 0) {
    const red = r.khata.red.slice(0, 2).map((a) => `🔴 ${a.name} ${rupees(a.outstandingPaise)} (${a.oldestUnpaidDays} din)`);
    L.push(`📒 Udhaar baaki ${rupees(r.khata.totalDuePaise)}${red.length ? " · " + red.join(" · ") : ""}`);
  }
  for (const p of r.payablesDue.slice(0, 2))
    L.push(`🧾 ${p.vendorName} ${rupees(p.amountPaise)} — ${p.dueInDays < 0 ? `${-p.dueInDays} din late` : p.dueInDays === 0 ? "aaj due" : `${p.dueInDays} din mein due`}`);

  for (const a of r.anomalies.slice(0, 2)) L.push(`⚠️ ${a.text}`);

  if (r.recommendations.length) {
    L.push("✅ *Suggestions:*");
    r.recommendations.forEach((x, i) => L.push(`${i + 1}. ${x.title}`));
  }
  if (opts.footer !== false) L.push("PDF ke liye *PDF* likhiye · Menu ke liye *Hi*");
  return L.join("\n");
}
