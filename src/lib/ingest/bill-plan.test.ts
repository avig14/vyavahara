import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { applySettingsPatch } from "../settings";
import { planBill } from "./bill-plan";
import type { Bill } from "./vision";

const now = new Date("2026-11-19T09:30:00Z"); // 19 Nov IST
const snap = generateSnapshot({ now });
const vendor = snap.vendors.find((v) => v.name === "Sharma Traders")!;
const line = (name: string, qty: number, price: number) => ({ name, qty, unit: "pc", unit_price: price, line_total: qty * price });
const good: Bill = {
  vendor_name: "Sharma Traders",
  invoice_no: "NEW-9001",
  invoice_date: "2026-11-18",
  items: [line("Maggi", 10, 12), line("Parle G", 5, 8)],
  total: 160,
};

describe("planBill: the review the owner accepts or rejects", () => {
  it("a clean read is 'good' and parks a stock_in with due date from the supplier's terms", () => {
    const { review, payload } = planBill(good, snap, { now });
    expect(review.verdict).toBe("good");
    expect(review.problems).toEqual([]);
    expect(payload?.kind).toBe("stock_in");
    expect(payload?.vendorId).toBe(vendor.id);
    expect(payload?.totalPaise).toBe(16000);
    expect(payload?.items).toHaveLength(2);
    expect(payload?.items[0].unitCostPaise).toBe(1200);
    expect(payload?.dueDate).toBe("2026-11-25"); // 18 Nov + 7 days
  });

  it("half the lines unknown: 'check', only matched lines add stock, owner is told", () => {
    const bill = { ...good, items: [...good.items, line("Zzzq Widget", 3, 50), line("Xxyy Gadget", 2, 20)], total: 350 };
    const { review, payload } = planBill(bill, snap, { now });
    expect(review.verdict).toBe("check");
    expect(review.unmatchedCount).toBe(2);
    expect(review.problems.join(" ")).toMatch(/2 ka stock add nahi hoga/);
    expect(review.problems.join(" ")).toMatch(/dobara lena/i); // 50% matched < default 70%
    expect(payload?.items).toHaveLength(2);
  });

  it("nothing matches: 'retake', nothing can be saved", () => {
    const bill = { ...good, items: [line("Zzzq Widget", 3, 50)], total: 150 };
    const { review, payload } = planBill(bill, snap, { now });
    expect(review.verdict).toBe("retake");
    expect(payload).toBeNull();
  });

  it("empty read (blurry photo or not a bill): 'retake' with a reason", () => {
    const { review, payload } = planBill({ vendor_name: null, invoice_no: null, invoice_date: null, items: [], total: null }, snap, { now });
    expect(review.verdict).toBe("retake");
    expect(review.problems.length).toBeGreaterThan(0);
    expect(payload).toBeNull();
  });

  it("lines that do not add up to the printed total are flagged but can still be accepted", () => {
    const { review, payload } = planBill({ ...good, total: 400 }, snap, { now });
    expect(review.verdict).toBe("check");
    expect(review.problems.join(" ")).toMatch(/fark/);
    expect(payload).not.toBeNull();
    expect(payload?.totalPaise).toBe(40000); // the printed total is what is owed
  });

  it("unknown supplier blocks; picking the supplier up front fixes it", () => {
    const odd = { ...good, vendor_name: "Qwerty Stores" };
    expect(planBill(odd, snap, { now }).review.verdict).toBe("retake");
    const fixed = planBill(odd, snap, { now, vendorId: vendor.id });
    expect(fixed.payload?.vendorId).toBe(vendor.id);
  });

  it("the same invoice twice is blocked so a retake cannot double the stock", () => {
    const p = snap.purchases.find((x) => x.invoiceNo)!;
    const v = snap.vendors.find((x) => x.id === p.vendorId)!;
    const { review, payload } = planBill({ ...good, vendor_name: v.name, invoice_no: p.invoiceNo }, snap, { now });
    expect(review.duplicate).toBe(true);
    expect(review.verdict).toBe("retake");
    expect(payload).toBeNull();
  });

  it("missing, garbled or future date falls back to today and says so", () => {
    for (const d of [null, "18/11/26", "2027-01-01"]) {
      const { review } = planBill({ ...good, invoice_date: d }, snap, { now });
      expect(review.invoiceDate).toBe("2026-11-19");
      expect(review.problems.join(" ")).toMatch(/date/);
    }
  });

  it("the same item on two lines becomes one stock line with a weighted rate", () => {
    const bill = { ...good, items: [line("Maggi", 10, 12), line("Maggi", 10, 14)], total: 260 };
    const { payload } = planBill(bill, snap, { now });
    expect(payload?.items).toHaveLength(1);
    expect(payload?.items[0].qty).toBe(20);
    expect(payload?.items[0].unitCostPaise).toBe(1300);
  });

  it("derives the rate from the line total when the unit price is unreadable", () => {
    const bill: Bill = { ...good, items: [{ name: "Maggi", qty: 10, unit: null, unit_price: null, line_total: 120 }], total: 120 };
    expect(planBill(bill, snap, { now }).payload?.items[0].unitCostPaise).toBe(1200);
  });

  it("an unreadable total falls back to the lines' sum and asks for a check", () => {
    const { review, payload } = planBill({ ...good, total: null }, snap, { now });
    expect(review.verdict).toBe("check");
    expect(payload?.totalPaise).toBe(16000);
  });

  it("how many lines must match is the merchant's setting", () => {
    const bill = { ...good, items: [...good.items, line("Zzzq Widget", 1, 10)], total: 170 };
    const lenient = applySettingsPatch(snap.settings, { ingest: { billMinMatchPct: 50 } });
    expect(lenient.ok).toBe(true);
    if (!lenient.ok) return;
    const strict = planBill(bill, snap, { now }).review.problems.join(" ");
    const loose = planBill(bill, { ...snap, settings: lenient.settings }, { now }).review.problems.join(" ");
    expect(strict).toMatch(/dobara lena/i); // 67% < 70
    expect(loose).not.toMatch(/dobara lena/i); // 67% ≥ 50
  });
});
