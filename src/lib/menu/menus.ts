/**
 * WhatsApp menu tree (PRD §A6), as pure data + renderers. No DB, no AI, no network: every leaf calls the same
 * analytics the agent tools and the dashboard use, so a menu digit is fast, free and gives the same numbers.
 * Leaves that need more from the owner (a vendor, a name and amount, dates) return `next` = what to wait for.
 */
import type { Snapshot } from "../domain";
import { byId } from "../domain";
import { daysLabel, num, rupees } from "../format";
import { istDayKey, istDayStart, MS_DAY, type PeriodName } from "../time";
import { buildContext, detectRecommendations, topRecommendations, type RecContext, type RecModule } from "../analytics/recommendations";
import { detectAnomalies } from "../analytics/anomalies";
import { openPayables, projectCashFlow } from "../analytics/cashflow";
import { festivalPlan } from "../analytics/festival";
import { segmentCustomers } from "../analytics/segments";
import { checkLoan } from "../analytics/loan";
import { gstSummary } from "../analytics/gst";
import type { KhataAccount } from "../analytics/khata-risk";
import { deadStockView, lostSalesView, priceChanges, reorderLines } from "../analytics/views";
import { buildReport } from "../reports/build";
import { reportText } from "../reports/text";
import { stockText } from "../wa/digest";
import { customerReportText, recommendationReportText, salesReportText, vendorReportText, withoutFoot } from "../wa/reports";

export interface MenuEnv {
  snap: Snapshot;
  ctx: RecContext;
}
export const menuEnv = (snap: Snapshot, ctx: RecContext = buildContext(snap)): MenuEnv => ({ snap, ctx });

/** What the bot waits for after a leaf. Stored in wa_sessions.context. Any menu word, "9" or an unrelated message drops it. */
export type Awaiting =
  | { kind: "custom_dates" }
  | { kind: "pick_po"; vendorIds: string[] }
  | { kind: "pick_pay"; purchaseIds: string[] }
  | { kind: "udhaar_entry" }
  | { kind: "pick_reminder"; customerIds: string[] }
  | { kind: "stock_add" }
  | { kind: "alert"; customerId: string; name: string }
  | { kind: "screenshot" };

export interface Leaf {
  text: string;
  next?: Awaiting;
  /** send the report as a PDF file after the text */
  pdf?: { period: PeriodName; custom?: { from: string; to: string } };
}

export type ModuleKey = "1" | "2" | "3" | "4" | "5";

interface ModuleDef {
  emoji: string;
  title: string;
  rec: RecModule;
  items: string[];
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  "1": { emoji: "📦", title: "Inventory", rec: "inventory", items: ["Stock dekho (low / out / all)", "Kya khatam hone wala hai?", "Kya order karna hai?", "Lost sales (maanga, nahi tha)", "Dead stock (nahi bik raha)", "Stock add karo (bill photo / bolo)", "Inventory suggestions"] },
  "2": { emoji: "🚚", title: "Vendors", rec: "vendors", items: ["Kisko kitna dena hai", "Purchase order banao", "Price badle?", "Vendor ko payment record karo", "Vendor suggestions", "Supplier report (poora)"] },
  "3": { emoji: "👥", title: "Customers & Khata", rec: "khata", items: ["Kiske kitne baaki hai", "Udhaar / payment likho", "⚠️ Risky customers", "Reminder message banao", "Regular / naye / gaye hue customers", "Khata suggestions", "Customer report (poora)"] },
  "4": { emoji: "📊", title: "Reports & Insights", rec: "growth", items: ["Aaj ka report", "Is hafte ka report", "Is mahine ka report", "Custom dates", "PDF mein bhejo", "Kuch alag hua?", "Top 3 suggestions", "Sales report (munafa, top items)"] },
  "5": { emoji: "🚀", title: "Growth & Finance", rec: "growth", items: ["Festival plan", "Paise ka hisaab (14 din)", "Loan eligibility check", "GST summary", "Payment screenshot check", "Growth suggestions", "Saari suggestions (module-wise)"] },
};

export const isModuleKey = (s: string): s is ModuleKey => s in MODULES;

const KEYCAP = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
export const NAV = "↩️ *9* peeche · *0* main menu · ya seedha poochho";
const CONFIRM_HINT = "*1* = Haan · *2* = Nahi";
void CONFIRM_HINT;

/* ---------------- words ---------------- */

const MENU_WORDS = new Set(["hi", "hii", "hiii", "hello", "hey", "hlo", "namaste", "namaskar", "menu", "help", "start", "0", "नमस्ते", "नमस्कार", "मेनू", "हेलो", "हाय", "मेन्यू"]);
const clean = (t: string) => t.trim().toLowerCase().replace(/[!.,?🙏\s]+$/gu, "").replace(/^[\s]+/u, "");

/** "Hi", "hello ji", "0", "नमस्ते" → main menu. A long sentence that merely starts with "hi" is a question, not a greeting. */
export function isMenuWord(raw: string): boolean {
  const t = clean(raw);
  if (!t) return false;
  if (MENU_WORDS.has(t)) return true;
  const w = t.split(/\s+/);
  return w.length <= 2 && MENU_WORDS.has(w[0]) && w[0] !== "0" && /^(ji|saathi|vyavahara|vyavahāra|bhai|bot)$/.test(w[1] ?? "ji");
}

export const isBack = (raw: string) => clean(raw) === "9";

/** "pdf", "pdf bhejo", "week ka pdf" → which report to attach. Long sentences go to the agent instead. */
export function pdfRequest(raw: string): { period: PeriodName } | null {
  const t = clean(raw);
  if (!/\bpdf\b/.test(t) || t.split(/\s+/).length > 5) return null;
  if (/(hafta|haftे|week|saptah|saptaah)/.test(t)) return { period: "this_week" };
  if (/(mahin|month)/.test(t)) return { period: "this_month" };
  if (/(kal|yesterday)/.test(t)) return { period: "yesterday" };
  return { period: "today" };
}

/* ---------------- helpers ---------------- */

const shop = (snap: Snapshot) => snap.merchant.name;
const firstName = (snap: Snapshot) => snap.merchant.ownerName.trim().split(/\s+/)[0] || "";
const dueText = (d: number) => (d < 0 ? `${-d} din late` : d === 0 ? "aaj due" : d === 1 ? "kal due" : `${d} din mein`);
const weekdayName = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
const sgn = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

/** One suggested next step for the module, from the same ranked recommendations as the dashboard. */
export function nextStep(env: MenuEnv, rec: RecModule | null): string | null {
  const r = detectRecommendations(env.snap, env.ctx).filter((x) => !rec || x.module === rec)[0];
  return r ? `👉 *Agla kadam:* ${r.title}` : null;
}

const tail = (env: MenuEnv, rec: RecModule | null) => ["", nextStep(env, rec), NAV].filter((x) => x !== null).join("\n");

/* ---------------- menus ---------------- */

export function mainMenu(env: MenuEnv): string {
  const { snap } = env;
  const today = buildReport(snap, { period: "today", ctx: env.ctx });
  const name = firstName(snap);
  return [
    `Namaste${name ? ` ${name} ji` : ""} 🙏 *${shop(snap)}*`,
    `Aaj ab tak *${rupees(today.sales.totalPaise)}* sales · ${today.sales.bills} bills`,
    "",
    ...(Object.keys(MODULES) as ModuleKey[]).map((k) => `${KEYCAP[Number(k)]} ${MODULES[k].emoji} ${MODULES[k].title}`),
    "",
    "Number bhejo, ya seedha poochho — jaise _\"aaj ki sales?\"_ 🎤 Voice note bhi chalega.",
  ].join("\n");
}

/** The 1–2 line live summary shown above a module's options. */
export function moduleSummary(key: ModuleKey, env: MenuEnv): string {
  const { snap, ctx } = env;
  switch (key) {
    case "1": {
      const c = (s: string) => ctx.forecasts.filter((f) => f.status === s).length;
      return `${snap.products.filter((p) => p.isActive).length} items · ${c("reorder")} jaldi khatam · ${c("stockout")} out of stock · ${rupees(deadStockView(snap, ctx).totalStuckPaise)} dead stock`;
    }
    case "2": {
      const rows = openPayables(snap).sort((a, b) => a.dueInDays - b.dueInDays);
      if (!rows.length) return "Koi supplier payment baaki nahi 🎉";
      const first = rows[0];
      return `${rupees(rows.reduce((s, p) => s + p.amountPaise, 0))} dena baaki · ${first.vendorName} ${rupees(first.amountPaise)} ${dueText(first.dueInDays)}`;
    }
    case "3": {
      const k = ctx.khata;
      return `${rupees(k.totalOutstandingPaise)} udhaar baaki · ${k.accounts.length} customers · 🔴 ${k.byBand.red.count} high risk`;
    }
    case "4": {
      const r = buildReport(snap, { period: "today", ctx });
      const c = r.sales.changePct;
      return `Aaj ${rupees(r.sales.totalPaise)}${c === null ? "" : ` · pichle ${weekdayName(snap.now)} se ${sgn(c)}${Math.abs(c)}%`}`;
    }
    case "5": {
      const f = festivalPlan(snap)[0];
      return f ? `Next: ${f.festival.name} (${f.festival.daysAway} din) · stock-up list ready` : "Abhi koi festival paas nahi";
    }
  }
}

export function moduleMenu(key: ModuleKey, env: MenuEnv): string {
  const m = MODULES[key];
  return [`${m.emoji} *${m.title.toUpperCase()}*`, moduleSummary(key, env), "", ...m.items.map((l, i) => `${KEYCAP[i + 1]} ${l}`), "", "↩️ *9* peeche · *0* main menu · ya seedha poochho"].join("\n");
}

/* ---------------- numbered picks ---------------- */

const numbered = (rows: string[]) => rows.map((r, i) => `*${i + 1}* ${r}`).join("\n");

/** "2" → 2 when it is a valid pick among `n` rows. */
export function pickIndex(raw: string, n: number): number | null {
  const m = clean(raw).match(/^(\d{1,2})$/);
  if (!m) return null;
  const i = Number(m[1]);
  return i >= 1 && i <= n ? i - 1 : null;
}

/* ---------------- leaves ---------------- */

const recList = (env: MenuEnv, rec: RecModule | null, title: string, n = 3): string => {
  const rows = rec ? detectRecommendations(env.snap, env.ctx).filter((x) => x.module === rec).slice(0, n) : topRecommendations(env.snap, n, env.ctx);
  if (!rows.length) return `${title}\nAbhi koi khaas suggestion nahi — sab theek chal raha hai ✅\n\n${NAV}`;
  return [title, ...rows.map((r, i) => `${i + 1}. ${r.title}`), "", NAV].join("\n");
};

export function dateRange(raw: string, now: Date): { from: string; to: string } | null {
  const year = Number(istDayKey(now).slice(0, 4));
  const today = istDayKey(now);
  const found: string[] = [];
  const re = /(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/g;
  for (const m of raw.matchAll(re)) {
    let y: number, mo: number, d: number;
    if (m[1]) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    else {
      [d, mo] = [Number(m[4]), Number(m[5])];
      y = m[6] ? (m[6].length === 2 ? 2000 + Number(m[6]) : Number(m[6])) : year;
    }
    const key = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const t = istDayStart(key);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || Number.isNaN(t.getTime()) || istDayKey(t) !== key) return null;
    // "25/12" typed in November means last December, not a future day
    found.push(!m[1] && !m[6] && key > today ? `${y - 1}${key.slice(4)}` : key);
  }
  if (found.length !== 2) return null;
  const [a, b] = found.sort();
  if (istDayStart(b).getTime() - istDayStart(a).getTime() > 366 * MS_DAY) return null;
  return { from: a, to: b };
}

export const pdfOf = (p: PeriodName): NonNullable<Leaf["pdf"]> => ({ period: p });

/** Run one menu leaf. null = not a valid option for that module. */
export function renderLeaf(key: ModuleKey, n: number, env: MenuEnv): Leaf | null {
  const { snap, ctx } = env;
  const mod = MODULES[key];
  const t = (body: string[], rec: RecModule | null = mod.rec): Leaf => ({ text: [...body, tail(env, rec)].join("\n") });

  switch (`${key}.${n}`) {
    /* ---- 1 inventory ---- */
    case "1.1":
      return t([stockText(snap, ctx)]);
    case "1.2": {
      const horizon = snap.settings.inventory.horizonDays;
      const rows = ctx.forecasts.filter((f) => f.status !== "dead" && f.daysToStockout < horizon).sort((a, b) => a.daysToStockout - b.daysToStockout).slice(0, 7);
      if (!rows.length) return t([`⏳ Agle ${horizon} din mein kuch khatam nahi hoga ✅`]);
      const u = byId(snap.products);
      return t([`⏳ *Jaldi khatam hone wale* (agle ${horizon} din)`, ...rows.map((f) => `• ${f.name}: ${f.status === "stockout" ? "*khatam*" : `~${daysLabel(f.daysToStockout)}`} · ${num(f.stock, 1)} ${u.get(f.productId)?.unit ?? ""} bacha`)]);
    }
    case "1.3": {
      const rows = reorderLines(snap, ctx);
      if (!rows.length) return t(["🛒 Abhi kuch order karne layak nahi ✅"]);
      const u = byId(snap.products);
      const by = new Map<string, typeof rows>();
      for (const r of rows) by.set(r.vendor?.name ?? "Supplier tay nahi", [...(by.get(r.vendor?.name ?? "Supplier tay nahi") ?? []), r]);
      const L = ["🛒 *Ab order karo*"];
      for (const [v, items] of by) L.push(`*${v}*`, ...items.slice(0, 6).map(({ f }) => `• ${f.name} × ${num(f.suggestedOrderQty, 0)} ${u.get(f.productId)?.unit ?? ""}`));
      L.push("", "Order message ke liye: *2* (Vendors) → *2*");
      return t(L);
    }
    case "1.4": {
      const v = lostSalesView(snap, "last_7_days");
      if (!v.items.length) return t(["❌ Pichle 7 din mein koi lost sale nahi ✅"]);
      return t([`❌ *Lost sales* (${v.label}): ${rupees(v.totalPaise)}`, ...v.items.slice(0, 6).map((x) => `• ${x.name}: ${num(x.requests, 0)} baar maanga · ${rupees(x.valuePaise)}`)]);
    }
    case "1.5": {
      const v = deadStockView(snap, ctx);
      if (!v.items.length) return t(["🧊 Koi dead stock nahi ✅"]);
      return t([`🧊 *Dead stock* — ${rupees(v.totalStuckPaise)} atka hai`, ...v.items.slice(0, 7).map((r) => `• ${r.name}: ${num(r.stock, 1)} ${r.unit} · ${rupees(r.stuckPaise)}`)]);
    }
    case "1.6":
      return { text: ["➕ *Stock add karo*", "📷 Supplier bill ki photo bhejo — main padh lunga", "ya likho: *item quantity* (jaise _Maggi 24_)", "", NAV].join("\n"), next: { kind: "stock_add" } };
    case "1.7":
      return { text: recList(env, "inventory", "💡 *Inventory suggestions*") };

    /* ---- 2 vendors ---- */
    case "2.1": {
      const rows = openPayables(snap).sort((a, b) => a.dueInDays - b.dueInDays);
      if (!rows.length) return t(["🧾 Koi supplier payment baaki nahi ✅"]);
      return t([`🧾 *Dena baaki: ${rupees(rows.reduce((s, p) => s + p.amountPaise, 0))}*`, ...rows.slice(0, 8).map((p) => `• ${p.vendorName} ${rupees(p.amountPaise)} — ${dueText(p.dueInDays)}`)]);
    }
    case "2.2": {
      const lines = reorderLines(snap, ctx).filter((x) => x.vendor);
      const vendors = [...new Map(lines.map((x) => [x.vendor!.id, x.vendor!])).values()];
      if (!vendors.length) return t(["🛒 Abhi kisi vendor se order karne layak kuch nahi ✅"]);
      return { text: ["🛒 *Kis vendor ka order banau?*", numbered(vendors.map((v) => `${v.name} (${lines.filter((x) => x.vendor!.id === v.id).length} items)`)), "", "Number bhejo", NAV].join("\n"), next: { kind: "pick_po", vendorIds: vendors.map((v) => v.id) } };
    }
    case "2.3": {
      const rows = priceChanges(snap).slice(0, 6);
      if (!rows.length) return t(["📈 Kisi item ka rate nahi badla ✅"]);
      return t(["📈 *Rate badle*", ...rows.map((r) => `• ${r.item} (${r.vendor}): ${rupees(r.fromPaise)} → ${rupees(r.toPaise)} (${r.pct > 0 ? "+" : ""}${r.pct}%)`)]);
    }
    case "2.4": {
      const rows = openPayables(snap).sort((a, b) => a.dueInDays - b.dueInDays).slice(0, 8);
      if (!rows.length) return t(["🧾 Koi bill baaki nahi — payment record karne ko kuch nahi ✅"]);
      return { text: ["💸 *Kiska payment ho gaya?*", numbered(rows.map((p) => `${p.vendorName} ${rupees(p.amountPaise)} — ${dueText(p.dueInDays)}`)), "", "Number bhejo", NAV].join("\n"), next: { kind: "pick_pay", purchaseIds: rows.map((p) => p.purchaseId) } };
    }
    case "2.5":
      return { text: recList(env, "vendors", "💡 *Vendor suggestions*") };
    case "2.6":
      return t([withoutFoot(vendorReportText(snap, ctx))]);

    /* ---- 3 customers & khata ---- */
    case "3.1": {
      const k = ctx.khata;
      if (!k.accounts.length) return t(["📒 Koi udhaar baaki nahi ✅"]);
      return t([`📒 *Udhaar baaki ${rupees(k.totalOutstandingPaise)}* (${k.accounts.length} customers)`, ...k.accounts.slice(0, 9).map((a) => `${a.emoji} ${a.name} ${rupees(a.outstandingPaise)} · ${a.oldestUnpaidDays} din`)]);
    }
    case "3.2":
      return { text: ["✍️ *Khata likho*", "*naam rakam* → udhaar diya (jaise _Suresh 300_)", "*naam rakam mila* → paise aaye (jaise _Ramesh 500 mila_)", "", NAV].join("\n"), next: { kind: "udhaar_entry" } };
    case "3.3": {
      const risky = ctx.khata.accounts.filter((a) => a.band === "red");
      if (!risky.length) return t(["⚠️ Koi high-risk customer nahi ✅"]);
      return t(["⚠️ *Risky customers*", ...risky.slice(0, 5).map((a) => `🔴 *${a.name}* ${rupees(a.outstandingPaise)} · ${a.oldestUnpaidDays} din\n   ${a.reasons.slice(0, 2).join(" · ")}`)]);
    }
    case "3.4": {
      const rows = ctx.khata.accounts.slice(0, 8);
      if (!rows.length) return t(["📒 Koi udhaar baaki nahi — reminder ki zaroorat nahi ✅"]);
      return { text: ["📨 *Kisko reminder banau?*", numbered(rows.map((a) => `${a.emoji} ${a.name} ${rupees(a.outstandingPaise)}`)), "", "Number bhejo", NAV].join("\n"), next: { kind: "pick_reminder", customerIds: rows.map((a) => a.customerId) } };
    }
    case "3.5": {
      const s = segmentCustomers(snap);
      const L = [`👥 *Customers*: ${s.counts.regular} regular · ${s.counts.new} naye · ${s.counts.lapsed} gaye hue · ${s.counts.occasional} kabhi-kabhi`];
      if (s.lapsed.length) L.push("", "📞 *Inhe call karo (aana band):*", ...s.lapsed.slice(0, 5).map((c) => `• ${c.name} — ${c.lastVisitDaysAgo} din se nahi aaye · ${rupees(c.lifetimePaise)} total`));
      return t(L);
    }
    case "3.6":
      return { text: recList(env, "khata", "💡 *Khata suggestions*") };
    case "3.7":
      return t([withoutFoot(customerReportText(snap))]);

    /* ---- 4 reports ---- */
    case "4.1":
    case "4.2":
    case "4.3": {
      const p = (["today", "this_week", "this_month"] as const)[n - 1];
      return t([reportText(buildReport(snap, { period: p, ctx }))], "growth");
    }
    case "4.4":
      return { text: ["📅 *Custom dates*", "Dono dates likho, jaise _1/11 to 15/11_", "", NAV].join("\n"), next: { kind: "custom_dates" } };
    case "4.5":
      return { text: `📄 Aaj ka PDF report bhej raha hoon…\n\n${NAV}`, pdf: pdfOf("today") };
    case "4.6": {
      const rows = detectAnomalies(snap);
      if (!rows.length) return t(["🔍 Kuch alag nahi hua — sab normal ✅"], "growth");
      return t(["🔍 *Kuch alag hua*", ...rows.slice(0, 5).map((a) => `• ${a.text}`)], "growth");
    }
    case "4.7":
      return { text: recList(env, null, "💡 *Top 3 suggestions*") };
    case "4.8":
      return t([withoutFoot(salesReportText(snap, "today", ctx))], "growth");

    /* ---- 5 growth & finance ---- */
    case "5.1": {
      const plans = festivalPlan(snap).slice(0, 1);
      if (!plans.length) return t(["🎉 Agle 45 din mein koi festival nahi"]);
      const p = plans[0];
      return t([`🎉 *${p.festival.name}* — ${p.festival.daysAway} din baaki (${p.festival.date})`, `Extra kamai ka andaaza: ${rupees(p.totalImpactPaise)}`, "", "*Zyada stock karo:*", ...p.items.slice(0, 6).map((i) => `• ${i.name} +${num(i.extraUnits, 0)}${i.learned ? " (aapki pichli sale se)" : ""}`)]);
    }
    case "5.2": {
      const cf = projectCashFlow(snap, { khata: ctx.khata.accounts, horizon: 14 });
      const L = [`💰 *Agle 14 din ka hisaab*`, `Aane wale: ${rupees(cf.totalInflowPaise)} (udhaar wapsi ${rupees(cf.collectionsPaise)} sahit)`, `Jaane wale: ${rupees(cf.totalOutflowPaise)}`];
      if (cf.warnings.length) for (const w of cf.warnings.slice(0, 2)) L.push("", `⚠️ ${w.date}: ${w.vendorName} ko ${rupees(w.payablePaise)} dena hai, ${rupees(w.shortfallPaise)} kam padega`, ...w.suggestions.slice(0, 2).map((s) => `• ${s.text}`));
      else L.push("✅ Koi paisa kam padne ka khatra nahi");
      return t(L);
    }
    case "5.3": {
      const l = checkLoan(snap);
      return t([`🏦 *Loan eligibility* (andaaza)`, l.eligible ? "✅ Aap eligible lag rahe hain" : "⚠️ Abhi eligible nahi lag rahe", `Avg mahine ka UPI: ${rupees(l.avgMonthlyUpiPaise)} · UPI share ${Math.round(l.upiShare * 100)}%`, ...(l.eligible ? [`Andaazan limit: ${rupees(l.indicativeMaxPaise)} (${l.lenderName})`] : []), ...l.reasons.slice(0, 3).map((r) => `• ${r}`), "", `_${l.disclaimer}_`]);
    }
    case "5.4": {
      const g = gstSummary(snap);
      const L = [`🧮 *GST* — ${g.period.label}`, `Turnover: ${rupees(g.turnoverPaise)}`];
      if (g.compositionTaxPaise !== undefined) L.push(`Composition tax (andaaza): ${rupees(g.compositionTaxPaise)}`);
      if (g.netPayablePaise !== undefined) L.push(`Output ${rupees(g.outputTaxPaise ?? 0)} − Input ${rupees(g.inputTaxPaise ?? 0)} = *${rupees(g.netPayablePaise)}*`);
      if (g.note) L.push(g.note);
      L.push("", `_${g.disclaimer}_`);
      return t(L);
    }
    case "5.5":
      return { text: ["🧾 *Payment screenshot check*", "Customer ka payment screenshot yahan forward karo 📷", "Main dekhunga ki payment sach mein aaya ya nahi.", "", NAV].join("\n"), next: { kind: "screenshot" } };
    case "5.6":
      return { text: recList(env, "growth", "💡 *Growth suggestions*") };
    case "5.7":
      return t([withoutFoot(recommendationReportText(snap, ctx))]);
  }
  return null;
}

/* ---------------- words the flows share ---------------- */

export function reminderText(snap: Snapshot, a: Pick<KhataAccount, "name" | "outstandingPaise">, payUrl: string | null): string {
  return [`Namaste ${a.name} ji 🙏`, `${shop(snap)} se aapke ${rupees(a.outstandingPaise)} baaki hain. Jab suvidha ho, kripya chuka dijiye.`, ...(payUrl ? [`UPI se abhi bhar sakte hain: ${payUrl}`] : []), "Dhanyavaad!"].join("\n");
}
