/**
 * Agent tools (PRD B7). Every tool wraps a pure analytics/report function (same ones menus, PDF and dashboard use)
 * and returns JSON: raw values + ₹-formatted strings. The model copies numbers, never computes them.
 * Writes: simple self-logs save at once; risky ones return status "needs_confirmation" (owner replies 1/2).
 */
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Snapshot, Customer } from "../domain";
import { byId } from "../domain";
import { rupees, num, daysLabel, toPaise } from "../format";
import { MS_DAY, istDayStart, type PeriodName } from "../time";
import { buildReport, type ReportData } from "../reports/build";
import { reportText } from "../reports/text";
import { buildContext, detectRecommendations, type RecContext } from "../analytics/recommendations";
import { deadStockView, lostSalesView, priceChanges, reorderLines as reorderLinesOf } from "../analytics/views";
import { detectAnomalies } from "../analytics/anomalies";
import { findAccountByName } from "../analytics/khata-risk";
import { projectCashFlow, openPayables } from "../analytics/cashflow";
import { festivalPlan } from "../analytics/festival";
import { segmentCustomers } from "../analytics/segments";
import { checkLoan } from "../analytics/loan";
import { gstSummary } from "../analytics/gst";
import { buildMatcher } from "../ingest/match";
import { confirmationMessage, udhaarGuard, type PendingPayload } from "./actions";
import type { AgentStore } from "./store";

export interface Attachment {
  kind: "report_pdf";
  period: PeriodName;
  custom?: { from: string; to: string };
}

export interface AgentEnv {
  snap: Snapshot;
  store: AgentStore;
  attachments: Attachment[];
  /** called with the tool name each time the model runs a tool (Voice Saathi shows these) */
  onTool?: (name: string) => void;
}

const PERIODS = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "last_7_days", "last_30_days", "custom"] as const;
const periodShape = {
  period: z.enum(PERIODS).optional().describe("Defaults to today"),
  from: z.string().optional().describe("YYYY-MM-DD (IST). Only with period=custom"),
  to: z.string().optional().describe("YYYY-MM-DD (IST), inclusive. Only with period=custom"),
};
type PeriodArgs = { period?: PeriodName; from?: string; to?: string };

const ok = (o: Record<string, unknown> = {}) => ({ status: "ok", ...o });

function customOf(a: PeriodArgs): { from: Date; to: Date } | undefined {
  if (a.period !== "custom") return undefined;
  if (!a.from || !a.to) throw new Error("custom period ke liye from aur to dates chahiye (YYYY-MM-DD)");
  return { from: istDayStart(a.from), to: new Date(istDayStart(a.to).getTime() + MS_DAY) };
}

export function findCustomer(snap: Snapshot, q: string): Customer | null {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  const c = snap.customers;
  const n = (x: Customer) => x.name.toLowerCase();
  return c.find((x) => n(x) === s) ?? c.find((x) => n(x).startsWith(s)) ?? c.find((x) => n(x).split(" ").some((w) => w.startsWith(s))) ?? c.find((x) => n(x).includes(s)) ?? null;
}

export function findVendor(snap: Snapshot, q: string) {
  const s = q.trim().toLowerCase();
  return snap.vendors.find((v) => v.name.toLowerCase().includes(s)) ?? null;
}

export function buildTools(env: AgentEnv) {
  const { snap, store } = env;
  let _ctx: RecContext | null = null;
  const ctx = () => (_ctx ??= buildContext(snap));
  const products = byId(snap.products);
  const matcher = buildMatcher(
    snap.products.filter((p) => p.isActive),
    snap.settings.ingest.matchMaxScore,
  );
  const unitOf = (pid: string) => products.get(pid)?.unit ?? "";

  const reportFor = (a: PeriodArgs, extra: { topN?: number; recs?: number } = {}): ReportData =>
    buildReport(snap, { period: a.period ?? "today", custom: customOf(a), ctx: ctx(), ...extra });

  const needProduct = (q: string) => {
    const m = matcher.match(q);
    if (!m) {
      const sug = matcher.suggest(q, 3).map((x) => x.product.name);
      throw new Error(`"${q}" naam ka item nahi mila.${sug.length ? ` Shayad: ${sug.join(", ")}` : ""}`);
    }
    return m.product;
  };
  const needCustomer = (q: string) => {
    const c = findCustomer(snap, q);
    if (!c) throw new Error(`"${q}" naam ka customer nahi mila`);
    return c;
  };

  const propose = async (p: PendingPayload, reasons: string[] = []) => {
    await store.createPending(p.kind, p);
    return { status: "needs_confirmation", message: confirmationMessage(p, reasons) };
  };

  function tool<S extends z.ZodType>(name: string, description: string, inputSchema: S, run: (a: z.infer<S>) => unknown | Promise<unknown>) {
    return betaZodTool({
      name,
      description,
      inputSchema,
      run: async (a) => {
        env.onTool?.(name);
        try {
          return JSON.stringify(await run(a));
        } catch (e) {
          return JSON.stringify({ status: "error", message: e instanceof Error ? e.message : String(e) });
        }
      },
    });
  }
  const none = z.object({});

  const reorderLines = (vendorName?: string) => reorderLinesOf(snap, ctx(), vendorName);

  return [
    /* ---------------- reports ---------------- */
    tool("get_report", "Full business report for a period as ready-to-send text. Use format pdf when the owner wants a PDF/file.", z.object({ ...periodShape, format: z.enum(["text", "pdf"]).optional() }), (a) => {
      const r = reportFor(a);
      if (a.format === "pdf") env.attachments.push({ kind: "report_pdf", period: a.period ?? "today", custom: a.period === "custom" && a.from && a.to ? { from: a.from, to: a.to } : undefined });
      return ok({ text: reportText(r), pdf: a.format === "pdf" ? "PDF saath me bheja ja raha hai" : undefined });
    }),

    tool("get_sales_summary", "Sales total, UPI/cash split, bills, average bill and change vs previous period.", z.object(periodShape), (a) => {
      const r = reportFor(a);
      const s = r.sales;
      return ok({ period: r.period.label, total: rupees(s.totalPaise), upi: rupees(s.upiPaise), cash: rupees(s.cashPaise), refunds: rupees(s.refundsPaise), bills: s.bills, avgBill: rupees(s.avgBillPaise), previous: rupees(s.prevTotalPaise), changePct: s.changePct });
    }),

    tool("get_profit", "Gross profit, expenses and net profit for a period.", z.object(periodShape), (a) => {
      const r = reportFor(a);
      return ok({ period: r.period.label, gross: rupees(r.profit.grossPaise), expenses: rupees(r.profit.expensesPaise), net: rupees(r.profit.netPaise) });
    }),

    tool("get_top_products", "Top selling items for a period, ranked by revenue, profit or quantity.", z.object({ ...periodShape, by: z.enum(["revenue", "profit", "qty"]).optional(), limit: z.number().int().min(1).max(15).optional() }), (a) => {
      const r = reportFor(a, { topN: 100 });
      const by = a.by ?? "revenue";
      const rows = [...r.topByRevenue].sort((x, y) => (by === "profit" ? y.profitPaise - x.profitPaise : by === "qty" ? y.qty - x.qty : y.revenuePaise - x.revenuePaise));
      return ok({ period: r.period.label, by, items: rows.slice(0, a.limit ?? 5).map((t) => ({ name: t.name, qty: num(t.qty, 1), unit: t.unit, revenue: rupees(t.revenuePaise), profit: rupees(t.profitPaise) })) });
    }),

    tool("get_anomalies", "Unusual things today (sales drop, refund spike, item sales drop).", none, () => ok({ items: detectAnomalies(snap).map((x) => x.text) })),

    tool("get_recommendations", "Top recommended actions ranked by rupee impact.", z.object({ module: z.enum(["inventory", "vendors", "khata", "growth"]).optional(), limit: z.number().int().min(1).max(10).optional() }), (a) => {
      const rows = detectRecommendations(snap, ctx()).filter((x) => !a.module || x.module === a.module).slice(0, a.limit ?? 5);
      return ok({ items: rows.map((x) => ({ title: x.title, module: x.module, impact: rupees(x.impactPaise), facts: x.facts })) });
    }),

    /* ---------------- inventory ---------------- */
    tool("get_inventory_status", "Stock status list. filter: all, out (stocked out), low (running out soon), overstock, dead.", z.object({ filter: z.enum(["all", "out", "low", "overstock", "dead"]).optional(), limit: z.number().int().min(1).max(20).optional() }), (a) => {
      const want = { out: "stockout", low: "reorder", overstock: "overstock", dead: "dead" } as const;
      const f = a.filter ?? "low";
      const rows = ctx().forecasts.filter((x) => f === "all" || x.status === want[f as keyof typeof want]);
      return ok({ filter: f, total: rows.length, items: rows.slice(0, a.limit ?? 10).map((x) => ({ name: x.name, stock: num(x.stock, 1), unit: unitOf(x.productId), status: x.status, daysLeft: daysLabel(x.daysToStockout), suggestedOrder: num(x.suggestedOrderQty, 0) })) });
    }),

    tool("get_stockout_forecast", "When will an item run out? Includes range, reorder point and suggested order quantity.", z.object({ product: z.string() }), (a) => {
      const p = needProduct(a.product);
      const x = ctx().forecasts.find((f) => f.productId === p.id);
      if (!x) throw new Error("is item ka forecast nahi hai");
      return ok({ name: x.name, stock: num(x.stock, 1), unit: p.unit, status: x.status, daysLeft: daysLabel(x.daysToStockout), range: `${daysLabel(x.daysToStockoutRange[0])} – ${daysLabel(x.daysToStockoutRange[1])}`, reorderPoint: num(x.reorderPoint, 0), suggestedOrder: num(x.suggestedOrderQty, 0), leadTimeDays: x.leadTimeDays, model: x.model, errorPct: Math.round(x.wape * 100) });
    }),

    tool("get_reorder_list", "Items to reorder now, with suggested quantities, optionally for one vendor.", z.object({ vendor: z.string().optional() }), (a) => {
      const rows = reorderLines(a.vendor);
      return ok({ count: rows.length, items: rows.map(({ f, vendor }) => ({ name: f.name, stock: num(f.stock, 1), order: `${num(f.suggestedOrderQty, 0)} ${unitOf(f.productId)}`, vendor: vendor?.name ?? null })) });
    }),

    tool("get_lost_sales", "Sales lost because customers asked for out-of-stock items.", z.object(periodShape), (a) => {
      const v = lostSalesView(snap, a.period ?? "last_7_days", customOf(a));
      return ok({ period: v.label, total: rupees(v.totalPaise), items: v.items.slice(0, 8).map((x) => ({ name: x.name, requests: num(x.requests, 0), value: rupees(x.valuePaise) })) });
    }),

    tool("get_dead_stock", "Items with no recent sales and the money stuck in them (at cost).", none, () => {
      const v = deadStockView(snap, ctx());
      return ok({ totalStuck: rupees(v.totalStuckPaise), items: v.items.slice(0, 10).map((r) => ({ name: r.name, stock: num(r.stock, 1), unit: r.unit, stuck: rupees(r.stuckPaise) })) });
    }),

    tool("adjust_stock", "Change an item's stock by delta (+/-). Needs owner confirmation.", z.object({ product: z.string(), delta: z.number() }), async (a) => {
      const p = needProduct(a.product);
      if (!a.delta) throw new Error("delta zero nahi ho sakta");
      return propose({ kind: "adjust_stock", productId: p.id, name: p.name, delta: a.delta, unit: p.unit });
    }),

    /* ---------------- vendors ---------------- */
    tool("get_payables", "Open vendor bills with due dates, optionally for one vendor.", z.object({ vendor: z.string().optional() }), (a) => {
      const rows = openPayables(snap).filter((p) => !a.vendor || p.vendorName.toLowerCase().includes(a.vendor.toLowerCase())).sort((x, y) => x.dueInDays - y.dueInDays);
      return ok({ total: rupees(rows.reduce((s, p) => s + p.amountPaise, 0)), items: rows.slice(0, 10).map((p) => ({ vendor: p.vendorName, invoice: p.invoiceNo, amount: rupees(p.amountPaise), due: p.dueInDays < 0 ? `${-p.dueInDays} din late` : p.dueInDays === 0 ? "aaj" : `${p.dueInDays} din mein`, dueDate: p.dueDate })) });
    }),

    tool("draft_purchase_order", "Draft an order for a vendor from the reorder list and save it. Returns a message the owner can forward.", z.object({ vendor: z.string() }), async (a) => {
      const v = findVendor(snap, a.vendor);
      if (!v) throw new Error(`"${a.vendor}" naam ka vendor nahi mila`);
      const lines = reorderLines(v.name).filter((x) => x.vendor?.id === v.id);
      if (!lines.length) return ok({ message: `${v.name} se abhi kuch order karne layak nahi hai.` });
      const items = lines.map(({ f }) => ({ productId: f.productId, name: f.name, qty: f.suggestedOrderQty, unit: unitOf(f.productId) }));
      await store.createPurchaseOrder(v.id, items);
      const text = `Namaste ${v.name}, kripya yeh bhej dijiye:\n${items.map((i) => `• ${i.name} × ${num(i.qty, 0)} ${i.unit}`).join("\n")}\nDhanyavaad — ${snap.merchant.name}`;
      return ok({ vendor: v.name, lines: items.length, forwardText: text });
    }),

    tool("get_price_changes", "Vendor price increases/decreases versus the previous purchase.", none, () =>
      ok({ items: priceChanges(snap).slice(0, 10).map((r) => ({ item: r.item, vendor: r.vendor, was: rupees(r.fromPaise), now: rupees(r.toPaise), changePct: r.pct })) }),
    ),

    tool("record_vendor_payment", "Mark a vendor's oldest open bill as paid (full, or amount_rupees for a part payment).", z.object({ vendor: z.string(), amount_rupees: z.number().positive().optional() }), async (a) => {
      const v = findVendor(snap, a.vendor);
      if (!v) throw new Error(`"${a.vendor}" naam ka vendor nahi mila`);
      const bill = openPayables(snap).filter((p) => p.vendorId === v.id).sort((x, y) => x.dueInDays - y.dueInDays)[0];
      if (!bill) throw new Error(`${v.name} ka koi bill baaki nahi hai`);
      const amt = a.amount_rupees ? toPaise(a.amount_rupees) : bill.amountPaise;
      await store.payVendorBill(bill.purchaseId, amt);
      return ok({ vendor: v.name, paid: rupees(amt), invoice: bill.invoiceNo });
    }),

    /* ---------------- khata ---------------- */
    tool("get_khata_overview", "Total udhaar, risk bands, ageing and the riskiest customers.", none, () => {
      const k = ctx().khata;
      return ok({ total: rupees(k.totalOutstandingPaise), expectedRecovery: rupees(k.expectedRecoveryPaise), bands: { green: { count: k.byBand.green.count, amount: rupees(k.byBand.green.outstandingPaise) }, amber: { count: k.byBand.amber.count, amount: rupees(k.byBand.amber.outstandingPaise) }, red: { count: k.byBand.red.count, amount: rupees(k.byBand.red.outstandingPaise) } }, ageing: { "0-15": rupees(k.ageing.d0_15), "16-30": rupees(k.ageing.d16_30), "31-60": rupees(k.ageing.d31_60), "60+": rupees(k.ageing.d60p) }, top: k.accounts.slice(0, 5).map((x) => ({ name: x.name, band: x.emoji, due: rupees(x.outstandingPaise), oldestDays: x.oldestUnpaidDays })) });
    }),

    tool("get_customer_khata", "One customer's udhaar, risk band and reasons.", z.object({ customer: z.string() }), (a) => {
      const acct = findAccountByName(ctx().khata.accounts, a.customer);
      if (!acct) {
        const c = needCustomer(a.customer);
        return ok({ name: c.name, due: rupees(0), message: "Koi udhaar baaki nahi", blocked: c.creditBlocked, limit: rupees(c.creditLimitPaise) });
      }
      return ok({ name: acct.name, band: acct.emoji, due: rupees(acct.outstandingPaise), oldestDays: acct.oldestUnpaidDays, limit: rupees(acct.creditLimitPaise), suggestedLimit: rupees(acct.suggestedLimitPaise), blocked: acct.creditBlocked, reasons: acct.reasons, lastPaymentDaysAgo: acct.daysSinceLastPayment, expectedRecovery: rupees(acct.expectedRecoveryPaise) });
    }),

    tool("log_udhaar", "Write a new udhaar (credit) for a customer. Risky ones need owner confirmation.", z.object({ customer: z.string(), amount_rupees: z.number().positive(), note: z.string().optional() }), async (a) => {
      const c = needCustomer(a.customer);
      const amountPaise = toPaise(a.amount_rupees);
      const g = udhaarGuard(ctx().khata, c, amountPaise);
      if (g.risky) return propose({ kind: "udhaar", customerId: c.id, name: c.name, amountPaise, note: a.note }, g.reasons);
      await store.addKhataEntry({ customerId: c.id, type: "credit", amountPaise, note: a.note });
      return ok({ message: `${c.name} ke naam ${rupees(amountPaise)} udhaar likh diya`, undo: "Galti? UNDO likhein" });
    }),

    tool("record_khata_payment", "Record that a customer paid back some udhaar.", z.object({ customer: z.string(), amount_rupees: z.number().positive() }), async (a) => {
      const c = needCustomer(a.customer);
      const amountPaise = toPaise(a.amount_rupees);
      await store.addKhataEntry({ customerId: c.id, type: "payment", amountPaise });
      return ok({ message: `${c.name} se ${rupees(amountPaise)} mil gaye`, undo: "Galti? UNDO likhein" });
    }),

    tool("set_credit_block", "Stop (blocked=true) or resume (blocked=false) udhaar for a customer. Needs owner confirmation.", z.object({ customer: z.string(), blocked: z.boolean() }), async (a) => {
      const c = needCustomer(a.customer);
      return propose({ kind: "block_credit", customerId: c.id, name: c.name, blocked: a.blocked });
    }),

    tool("draft_reminder", "Polite payment reminder text for a customer. Only drafts, never sends.", z.object({ customer: z.string() }), (a) => {
      const acct = findAccountByName(ctx().khata.accounts, a.customer);
      if (!acct) throw new Error("is customer ka koi udhaar baaki nahi");
      return ok({ forwardText: `Namaste ${acct.name} ji 🙏 ${snap.merchant.name} se aapke ${rupees(acct.outstandingPaise)} baaki hain. Jab suvidha ho, kripya chuka dijiye. Dhanyavaad!` });
    }),

    tool("get_segments", "Customer segments: regular, new, lapsed, occasional, and who to call back.", none, () => {
      const s = segmentCustomers(snap);
      return ok({ counts: s.counts, lapsed: s.lapsed.slice(0, 5).map((c) => ({ name: c.name, lastVisitDaysAgo: c.lastVisitDaysAgo, lifetimeSpend: rupees(c.lifetimePaise) })) });
    }),

    /* ---------------- expenses / cash ---------------- */
    tool("log_expense", "Log a shop expense.", z.object({ category: z.enum(["rent", "electricity", "salary", "transport", "other"]), amount_rupees: z.number().positive(), note: z.string().optional() }), async (a) => {
      const amountPaise = toPaise(a.amount_rupees);
      await store.addExpense({ category: a.category, amountPaise, note: a.note });
      return ok({ message: `${a.category} kharcha ${rupees(amountPaise)} likh diya`, undo: "Galti? UNDO likhein" });
    }),

    tool("record_cash_sale", "Record a cash sale (no UPI record exists for it).", z.object({ amount_rupees: z.number().positive() }), async (a) => {
      const amountPaise = toPaise(a.amount_rupees);
      await store.addCashSale(amountPaise);
      return ok({ message: `Cash sale ${rupees(amountPaise)} likh di`, undo: "Galti? UNDO likhein" });
    }),

    /* ---------------- growth & finance ---------------- */
    tool("get_festival_plan", "Upcoming festivals and what to stock more of, with expected extra profit.", none, () => {
      const plans = festivalPlan(snap).slice(0, 2);
      return ok({ festivals: plans.map((p) => ({ name: p.festival.name, date: p.festival.date, daysAway: p.festival.daysAway, extraProfit: rupees(p.totalImpactPaise), items: p.items.slice(0, 6).map((i) => ({ name: i.name, extraUnits: num(i.extraUnits, 0), uplift: i.uplift, learnedFromYourPastSales: i.learned })) })) });
    }),

    tool("get_cashflow_forecast", "Expected cash in/out for the next days and any shortfall before a vendor payment.", z.object({ days: z.number().int().min(3).max(30).optional() }), (a) => {
      const cf = a.days ? projectCashFlow(snap, { khata: ctx().khata.accounts, horizon: a.days }) : ctx().cash;
      return ok({ days: cf.series.length, expectedIn: rupees(cf.totalInflowPaise), expectedOut: rupees(cf.totalOutflowPaise), fromKhata: rupees(cf.collectionsPaise), warnings: cf.warnings.map((w) => ({ date: w.date, vendor: w.vendorName, payable: rupees(w.payablePaise), shortfall: rupees(w.shortfallPaise), suggestions: w.suggestions.map((s) => s.text) })) });
    }),

    tool("check_loan_eligibility", "Indicative loan eligibility from UPI history. Not a loan offer.", none, () => {
      const l = checkLoan(snap);
      return ok({ eligible: l.eligible, avgMonthlyUpi: rupees(l.avgMonthlyUpiPaise), upiSharePct: Math.round(l.upiShare * 100), indicativeMax: rupees(l.indicativeMaxPaise), lender: l.lenderName, reasons: l.reasons, recommendation: l.recommendation, disclaimer: l.disclaimer });
    }),

    tool("get_gst_summary", "GST estimate for the current quarter. Indicative only.", none, () => {
      const g = gstSummary(snap);
      return ok({ scheme: g.scheme, period: g.period.label, turnover: rupees(g.turnoverPaise), compositionTax: g.compositionTaxPaise !== undefined ? rupees(g.compositionTaxPaise) : undefined, outputTax: g.outputTaxPaise !== undefined ? rupees(g.outputTaxPaise) : undefined, inputTax: g.inputTaxPaise !== undefined ? rupees(g.inputTaxPaise) : undefined, netPayable: g.netPayablePaise !== undefined ? rupees(g.netPayablePaise) : undefined, note: g.note, disclaimer: g.disclaimer });
    }),
  ];
}
