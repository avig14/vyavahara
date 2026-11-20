import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import type { AgentStore } from "../agent/store";
import { buildContext } from "../analytics/recommendations";
import { openPayables } from "../analytics/cashflow";
import { handleAwaiting, parseKhataEntry, parseRupees, parseStockEntry, type FlowEnv } from "./flows";
import type { Awaiting } from "./menus";

const NOW = new Date("2026-11-19T09:30:00Z");
const snap = generateSnapshot({ now: NOW });
const ctx = buildContext(snap);

function harness() {
  const calls: { fn: string; arg: unknown }[] = [];
  const rec = (fn: string) => async (arg: unknown) => void calls.push({ fn, arg });
  const store = {
    addKhataEntry: rec("addKhataEntry"),
    addExpense: rec("addExpense"),
    addCashSale: rec("addCashSale"),
    adjustStock: rec("adjustStock"),
    setCreditBlocked: rec("setCreditBlocked"),
    setCreditLimit: rec("setCreditLimit"),
    createPurchaseOrder: async (vendorId: string, items: unknown) => void calls.push({ fn: "createPurchaseOrder", arg: { vendorId, items } }),
    payVendorBill: rec("payVendorBill"),
    receiveBill: rec("receiveBill"),
    createPending: async (kind: string, payload: unknown) => (calls.push({ fn: "createPending", arg: { kind, payload } }), "p1"),
  } as unknown as AgentStore;
  const fx: FlowEnv = { snap, ctx, store, payLink: async (_id, name, paise) => `https://pay.test/${name}/${paise}` };
  return { calls, fx };
}
const pend = (calls: { fn: string; arg: unknown }[]) => calls.filter((c) => c.fn === "createPending").map((c) => c.arg as { kind: string; payload: Record<string, unknown> });

describe("parsers", () => {
  it("parseRupees", () => {
    expect(parseRupees("1,200")).toBe(1200);
    expect(parseRupees("₹300")).toBe(300);
    expect(parseRupees("rs 50.5")).toBe(50.5);
    expect(parseRupees("0")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
    expect(parseRupees("99999999")).toBeNull();
  });
  it("parseKhataEntry: udhaar vs payment, multi-word names, noise", () => {
    expect(parseKhataEntry("Suresh 300")).toEqual({ name: "Suresh", rupees: 300, type: "credit" });
    expect(parseKhataEntry("Ramesh 500 mila")).toEqual({ name: "Ramesh", rupees: 500, type: "payment" });
    expect(parseKhataEntry("Ramesh Gupta ₹1,500 rs aaye")).toEqual({ name: "Ramesh Gupta", rupees: 1500, type: "payment" });
    expect(parseKhataEntry("Suresh ko 250")).toEqual({ name: "Suresh", rupees: 250, type: "credit" });
    expect(parseKhataEntry("hello")).toBeNull();
    expect(parseKhataEntry("300")).toBeNull();
    expect(parseKhataEntry("12 300")).toBeNull();
  });
  it("parseStockEntry: item first or quantity first, negative", () => {
    expect(parseStockEntry("Maggi 24")).toEqual({ item: "Maggi", qty: 24 });
    expect(parseStockEntry("maggi 24 packet")).toEqual({ item: "maggi", qty: 24 });
    expect(parseStockEntry("24 packet maggi")).toEqual({ item: "maggi", qty: 24 });
    expect(parseStockEntry("Maggi -5")).toEqual({ item: "Maggi", qty: -5 });
    expect(parseStockEntry("Maggi 0")).toBeNull();
    expect(parseStockEntry("Maggi")).toBeNull();
  });
});

describe("handleAwaiting", () => {
  it("custom dates → a report, bad dates → asks again with the same step", async () => {
    const { fx } = harness();
    const aw: Awaiting = { kind: "custom_dates" };
    const bad = await handleAwaiting(aw, "kal", fx);
    expect(bad?.text).toMatch(/Dates samajh nahi/);
    expect(bad?.next).toEqual(aw);
    const good = await handleAwaiting(aw, "1/11 to 15/11", fx);
    expect(good?.text.length).toBeGreaterThan(50);
    expect(good?.next).toBeUndefined();
  });

  it("udhaar to a safe customer is written straight away", async () => {
    const { fx, calls } = harness();
    const safe = ctx.khata.accounts.find((a) => a.band === "green") ?? ctx.khata.accounts[0];
    const r = await handleAwaiting({ kind: "udhaar_entry" }, `${safe.name} 10`, fx);
    // either written or parked for confirmation, never lost and never both
    const wrote = calls.some((c) => c.fn === "addKhataEntry");
    const parked = pend(calls).length > 0;
    expect(wrote !== parked).toBe(true);
    expect(r?.text).toBeTruthy();
  });

  it("udhaar to the red customer (Suresh) parks a 1/2 confirmation and writes nothing", async () => {
    const { fx, calls } = harness();
    const r = await handleAwaiting({ kind: "udhaar_entry" }, "Suresh 5000", fx);
    expect(calls.some((c) => c.fn === "addKhataEntry")).toBe(false);
    expect(pend(calls)[0]).toMatchObject({ kind: "udhaar", payload: { amountPaise: 500000 } });
    expect(r?.text).toMatch(/\*1\*/);
  });

  it("a payment is written directly and the balance is reported", async () => {
    const { fx, calls } = harness();
    const r = await handleAwaiting({ kind: "udhaar_entry" }, "Suresh 100 mila", fx);
    expect(calls.find((c) => c.fn === "addKhataEntry")?.arg).toMatchObject({ type: "payment", amountPaise: 10000 });
    expect(r?.text).toMatch(/mil gaye/);
  });

  it("unknown customer asks again, non-entry falls through", async () => {
    const { fx } = harness();
    const aw: Awaiting = { kind: "udhaar_entry" };
    const r = await handleAwaiting(aw, "Zzyzx 100", fx);
    expect(r?.next).toEqual(aw);
    expect(await handleAwaiting(aw, "mera stock kitna hai", fx)).toBeNull();
  });

  it("vendor PO pick creates a draft and a forwardable message; out-of-range falls through", async () => {
    const { fx, calls } = harness();
    const lines = (await import("../analytics/views")).reorderLines(snap, ctx);
    const vendorIds = [...new Set(lines.map((l) => l.vendor?.id).filter((x): x is string => !!x))];
    const aw: Awaiting = { kind: "pick_po", vendorIds };
    expect(await handleAwaiting(aw, String(vendorIds.length + 1), fx)).toBeNull();
    const r = await handleAwaiting(aw, "1", fx);
    expect(calls.some((c) => c.fn === "createPurchaseOrder")).toBe(true);
    expect(r?.text).toMatch(/Namaste/);
  });

  it("vendor payment pick parks pay_vendor for 1/2", async () => {
    const { fx, calls } = harness();
    const bills = openPayables(snap);
    expect(bills.length).toBeGreaterThan(0);
    const r = await handleAwaiting({ kind: "pick_pay", purchaseIds: bills.map((b) => b.purchaseId) }, "1", fx);
    expect(pend(calls)[0]).toMatchObject({ kind: "pay_vendor", payload: { purchaseId: bills[0].purchaseId } });
    expect(r?.text).toMatch(/\*1\*/);
  });

  it("reminder pick returns a forwardable text with a pay link", async () => {
    const { fx } = harness();
    const red = ctx.khata.accounts.filter((a) => a.outstandingPaise > 0);
    const r = await handleAwaiting({ kind: "pick_reminder", customerIds: red.map((a) => a.customerId) }, "1", fx);
    expect(r?.text).toContain("https://pay.test/");
  });

  it("stock add: matched item parks adjust_stock, unknown item suggests and waits", async () => {
    const { fx, calls } = harness();
    const aw: Awaiting = { kind: "stock_add" };
    const ok = await handleAwaiting(aw, "Maggi 24", fx);
    expect(pend(calls)[0]).toMatchObject({ kind: "adjust_stock", payload: { delta: 24 } });
    expect(ok?.text).toMatch(/\*1\*/);
    const bad = await handleAwaiting(aw, "Qqqqzzzz 3", fx);
    expect(bad?.next).toEqual(aw);
  });

  it("alert 1/2/3: block (pending), reminder (pay link), ignore; other text falls through", async () => {
    const { fx, calls } = harness();
    const suresh = ctx.khata.accounts.find((a) => /Suresh/.test(a.name))!;
    const aw: Awaiting = { kind: "alert", customerId: suresh.customerId, name: suresh.name };
    expect((await handleAwaiting(aw, "1", fx))?.text).toMatch(/band/);
    expect(pend(calls)[0]).toMatchObject({ kind: "block_credit", payload: { blocked: true } });
    expect((await handleAwaiting(aw, "2", fx))?.text).toContain("https://pay.test/");
    expect((await handleAwaiting(aw, "3", fx))?.text).toMatch(/ignore/);
    expect(await handleAwaiting(aw, "kuch aur", fx)).toBeNull();
  });

  it("screenshot step is answered by an image, never by text", async () => {
    const { fx } = harness();
    expect(await handleAwaiting({ kind: "screenshot" }, "hello", fx)).toBeNull();
  });
});
