import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { buildContext } from "../analytics/recommendations";
import { buildReport } from "../reports/build";
import { rupees } from "../format";
import { buildTools } from "./tools";
import { confirmationMessage, executePending, parseChoice, udhaarGuard, type PendingPayload } from "./actions";
import { cleanHistory, runAgentWith } from "./run";
import type { AgentStore } from "./store";
import type { Attachment } from "./tools";

const snap = generateSnapshot({ now: new Date("2026-11-19T09:30:00Z") });
const ctx = buildContext(snap);

function fakeStore() {
  const calls: { fn: string; args: unknown[] }[] = [];
  const rec = (fn: string) => async (...args: unknown[]) => void calls.push({ fn, args });
  const store = {
    addKhataEntry: rec("addKhataEntry"),
    addExpense: rec("addExpense"),
    addCashSale: rec("addCashSale"),
    adjustStock: rec("adjustStock"),
    setCreditBlocked: rec("setCreditBlocked"),
    setCreditLimit: rec("setCreditLimit"),
    createPurchaseOrder: rec("createPurchaseOrder"),
    payVendorBill: rec("payVendorBill"),
    receiveBill: rec("receiveBill"),
    createPending: async (...args: unknown[]) => (calls.push({ fn: "createPending", args }), "p1"),
  } as unknown as AgentStore;
  return { store, calls };
}

function setup() {
  const { store, calls } = fakeStore();
  const attachments: Attachment[] = [];
  const tools = buildTools({ snap, store, attachments });
  const call = async (name: string, args: object = {}) => {
    const t = tools.find((x) => x.name === name);
    if (!t) throw new Error("no tool " + name);
    return JSON.parse((await (t as unknown as { run: (a: object) => Promise<string> }).run(args)) as string);
  };
  return { tools, call, calls, attachments };
}

describe("tools", () => {
  it("has unique names and the PRD P0 set", () => {
    const { tools } = setup();
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of ["get_report", "get_sales_summary", "get_inventory_status", "get_khata_overview", "log_udhaar", "set_credit_block", "log_expense", "get_festival_plan", "get_cashflow_forecast", "check_loan_eligibility", "get_gst_summary"]) expect(names).toContain(n);
  });

  it("sales numbers come straight from the report builder", async () => {
    const { call } = setup();
    const r = buildReport(snap, { period: "yesterday", ctx });
    const out = await call("get_sales_summary", { period: "yesterday" });
    expect(out.total).toBe(rupees(r.sales.totalPaise));
    expect(out.bills).toBe(r.sales.bills);
    expect(out.changePct).toBe(r.sales.changePct);
  });

  it("pdf report queues an attachment; text report does not", async () => {
    const a = setup();
    await a.call("get_report", { period: "this_week", format: "pdf" });
    expect(a.attachments).toEqual([{ kind: "report_pdf", period: "this_week", custom: undefined }]);
    const b = setup();
    const out = await b.call("get_report", { period: "today" });
    expect(b.attachments).toHaveLength(0);
    expect(out.text).toContain("report");
  });

  it("custom period needs dates", async () => {
    const out = await setup().call("get_sales_summary", { period: "custom" });
    expect(out.status).toBe("error");
  });

  it("risky udhaar (red customer) needs confirmation and writes nothing", async () => {
    const { call, calls } = setup();
    const red = ctx.khata.accounts.find((a) => a.band === "red")!;
    const out = await call("log_udhaar", { customer: red.name, amount_rupees: 100 });
    expect(out.status).toBe("needs_confirmation");
    expect(out.message).toContain("1");
    expect(calls.map((c) => c.fn)).toEqual(["createPending"]);
  });

  it("safe udhaar saves at once", async () => {
    const { call, calls } = setup();
    const green = ctx.khata.accounts.find((a) => a.band === "green" && !a.creditBlocked)!;
    const out = await call("log_udhaar", { customer: green.name, amount_rupees: 1 });
    expect(out.status).toBe("ok");
    expect(calls.map((c) => c.fn)).toEqual(["addKhataEntry"]);
  });

  it("credit block and stock adjust always ask first", async () => {
    const { call, calls } = setup();
    expect((await call("set_credit_block", { customer: ctx.khata.accounts[0].name, blocked: true })).status).toBe("needs_confirmation");
    expect((await call("adjust_stock", { product: "maggi", delta: 5 })).status).toBe("needs_confirmation");
    expect(calls.every((c) => c.fn === "createPending")).toBe(true);
  });

  it("simple self-logs save immediately", async () => {
    const { call, calls } = setup();
    await call("log_expense", { category: "transport", amount_rupees: 250 });
    await call("record_cash_sale", { amount_rupees: 80 });
    expect(calls.map((c) => c.fn)).toEqual(["addExpense", "addCashSale"]);
    expect((calls[0].args[0] as { amountPaise: number }).amountPaise).toBe(25_000);
  });

  it("unknown item or customer returns an error, not a crash", async () => {
    const { call } = setup();
    expect((await call("adjust_stock", { product: "zzqq nothing", delta: 1 })).status).toBe("error");
    expect((await call("get_customer_khata", { customer: "Nobody Atall" })).status).toBe("error");
  });

  it("draft_purchase_order saves a draft for a vendor with reorder lines", async () => {
    const { call, calls } = setup();
    const list = await call("get_reorder_list");
    const vendor = list.items.find((i: { vendor: string | null }) => i.vendor)?.vendor as string;
    expect(vendor).toBeTruthy();
    const out = await call("draft_purchase_order", { vendor });
    expect(out.status).toBe("ok");
    expect(calls.some((c) => c.fn === "createPurchaseOrder")).toBe(true);
    expect(out.forwardText).toContain(vendor);
  });

  it("loan and GST tools carry their disclaimers", async () => {
    const { call } = setup();
    expect((await call("check_loan_eligibility")).disclaimer).toBeTruthy();
    expect((await call("get_gst_summary")).disclaimer).toBeTruthy();
  });
});

describe("pending actions", () => {
  it("parseChoice", () => {
    expect(parseChoice("1")).toBe(1);
    expect(parseChoice(" Haan ")).toBe(1);
    expect(parseChoice("2")).toBe(2);
    expect(parseChoice("nahi")).toBe(2);
    expect(parseChoice("maggi kitni bachi")).toBeNull();
  });

  const payloads: PendingPayload[] = [
    { kind: "block_credit", customerId: "c", name: "Suresh", blocked: true },
    { kind: "set_limit", customerId: "c", name: "Suresh", limitPaise: 200000 },
    { kind: "adjust_stock", productId: "p", name: "Maggi", delta: -3, unit: "pc" },
    { kind: "udhaar", customerId: "c", name: "Suresh", amountPaise: 50000 },
    { kind: "pay_vendor", purchaseId: "b", vendorName: "Sharma", amountPaise: 120000 },
    { kind: "create_po", vendorId: "v", vendorName: "Sharma", items: [{ productId: "p", name: "Maggi", qty: 10, unit: "pc" }] },
    { kind: "stock_in", vendorId: "v", vendorName: "Sharma", invoiceNo: "I1", invoiceDate: "2026-11-18", dueDate: "2026-12-02", totalPaise: 160000, items: [{ productId: "p", name: "Maggi", qty: 10, unitCostPaise: 1200 }] },
  ];
  it("every kind has a 1/2 question and an executor that writes", async () => {
    for (const p of payloads) {
      expect(confirmationMessage(p)).toMatch(/\*1\*[\s\S]*\*2\*/);
      const { store, calls } = fakeStore();
      const reply = await executePending(store, p);
      expect(reply.length).toBeGreaterThan(5);
      expect(calls).toHaveLength(1);
    }
  });

  it("guard: limit, blocked and red", () => {
    const red = ctx.khata.accounts.find((a) => a.band === "red")!;
    const cust = snap.customers.find((c) => c.id === red.customerId)!;
    expect(udhaarGuard(ctx.khata, cust, 100).risky).toBe(true);
    const clean = snap.customers.find((c) => !ctx.khata.accounts.some((a) => a.customerId === c.id) && !c.creditBlocked)!;
    expect(udhaarGuard(ctx.khata, { ...clean, creditLimitPaise: 0 }, 10_000_000).risky).toBe(false);
    expect(udhaarGuard(ctx.khata, { ...clean, creditLimitPaise: 5000 }, 10_000).risky).toBe(true);
    expect(udhaarGuard(ctx.khata, { ...clean, creditBlocked: true }, 100).risky).toBe(true);
  });
});

describe("runAgentWith (fake client, no live call)", () => {
  const fakeClient = (final: unknown) => ({ beta: { messages: { toolRunner: async () => final } } }) as never;
  const base = { snap, store: fakeStore().store, history: [], text: "aaj ki sale?" };

  it("joins text blocks", async () => {
    const r = await runAgentWith({ ...base, client: fakeClient({ stop_reason: "end_turn", content: [{ type: "text", text: "A" }, { type: "tool_use" }, { type: "text", text: "B" }] }) });
    expect(r.text).toBe("A\nB");
  });
  it("refusal and empty reply fall back", async () => {
    expect((await runAgentWith({ ...base, client: fakeClient({ stop_reason: "refusal", content: [] }) })).text).toMatch(/Maaf/);
    expect((await runAgentWith({ ...base, client: fakeClient({ stop_reason: "end_turn", content: [] }) })).text).toMatch(/Abhi jawab/);
  });
  it("history always starts with a user turn", () => {
    expect(cleanHistory([{ role: "assistant", content: "x" }, { role: "user", content: "y" }])).toEqual([{ role: "user", content: "y" }]);
    expect(cleanHistory([{ role: "assistant", content: "x" }])).toEqual([]);
  });
});
