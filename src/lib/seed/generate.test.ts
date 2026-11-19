import { describe, expect, it } from "vitest";
import { generateSnapshot } from "./generate";
import { addDays, istDayKey, istWeekday, startOfIstDay } from "../time";

// Thursday 19 Nov 2026, 15:00 IST
const NOW = new Date("2026-11-19T09:30:00Z");
const snap = generateSnapshot({ now: NOW });
const P = (id: string) => snap.products.find((p) => p.id === id)!;

describe("seed generator", () => {
  it("is deterministic", () => {
    const again = generateSnapshot({ now: NOW });
    expect(again.transactions.length).toBe(snap.transactions.length);
    expect(again.transactions[100].amountPaise).toBe(snap.transactions[100].amountPaise);
  });

  it("has 120 days of history and ~40 items", () => {
    expect(snap.products.length).toBeGreaterThanOrEqual(40);
    const days = new Set(snap.transactions.map((t) => istDayKey(t.createdAt)));
    expect(days.size).toBeGreaterThanOrEqual(118);
    expect(snap.transactions.every((t) => t.createdAt.getTime() <= NOW.getTime())).toBe(true);
  });

  it("sale item totals match transaction totals", () => {
    const sums = new Map<string, number>();
    for (const si of snap.saleItems) sums.set(si.transactionId, (sums.get(si.transactionId) ?? 0) + si.qty * si.unitPricePaise);
    for (const t of snap.transactions.filter((x) => x.kind === "sale")) expect(sums.get(t.id)).toBe(t.amountPaise);
  });

  it("purchase totals match line items", () => {
    const sums = new Map<string, number>();
    for (const i of snap.purchaseItems) sums.set(i.purchaseId, (sums.get(i.purchaseId) ?? 0) + i.qty * i.unitCostPaise);
    for (const p of snap.purchases) expect(sums.get(p.id)).toBe(p.totalPaise);
  });

  it("UPI share is ~70% and monthly UPI ≈ ₹3.4L", () => {
    const sales = snap.transactions.filter((t) => t.kind === "sale");
    const upi = sales.filter((t) => t.method === "upi");
    expect(upi.length / sales.length).toBeGreaterThan(0.66);
    expect(upi.length / sales.length).toBeLessThan(0.78);
    const total = upi.reduce((s, t) => s + t.amountPaise, 0);
    const monthly = (total / 120) * 30.4;
    expect(monthly).toBeGreaterThan(30_000_000); // ≥ ₹3.0L
    expect(monthly).toBeLessThan(40_000_000); // ≤ ₹4.0L
  });

  it("story: Maggi stock ≈ 2.2 days", () => {
    const sold28 = snap.saleItems
      .filter((s) => s.productId === "p_maggi" && s.createdAt >= addDays(NOW, -28))
      .reduce((s, i) => s + i.qty, 0);
    const perDay = sold28 / 28;
    const days = P("p_maggi").stockQty / perDay;
    expect(days).toBeGreaterThan(1.6);
    expect(days).toBeLessThan(3);
  });

  it("story: Amul Taaza stock 0 and 14 lost-demand rows this week", () => {
    expect(P("p_taaza").stockQty).toBe(0);
    const rows = snap.lostDemand.filter((l) => l.productId === "p_taaza" && l.createdAt >= addDays(NOW, -7));
    expect(rows.length).toBe(14);
    expect(rows.every((r) => r.estValuePaise > 0)).toBe(true);
  });

  it("story: dead stock ≈ ₹3,200 at cost, no sales 35+ days", () => {
    const dead = ["p_hairoil", "p_tang"];
    const value = dead.reduce((s, id) => s + P(id).stockQty * P(id).costPaise, 0);
    expect(value).toBe(320000);
    const cutoff = addDays(NOW, -35);
    for (const id of dead) {
      expect(snap.saleItems.some((s) => s.productId === id && s.createdAt >= cutoff)).toBe(false);
      expect(snap.saleItems.some((s) => s.productId === id)).toBe(true); // did sell earlier
    }
  });

  it("story: Parle-G +8% at Sharma, Gupta Agency 5% cheaper", () => {
    const sharma = snap.vendorProducts.find((v) => v.vendorId === "v_sharma" && v.productId === "p_parleg")!;
    const gupta = snap.vendorProducts.find((v) => v.vendorId === "v_gupta" && v.productId === "p_parleg")!;
    expect(sharma.lastCostPaise / sharma.prevCostPaise! - 1).toBeCloseTo(0.08, 3);
    expect(1 - gupta.lastCostPaise / sharma.lastCostPaise).toBeCloseTo(0.05, 2);
  });

  it("story: Sharma Traders ₹12,400 due in 2 days", () => {
    const due = snap.purchases.find((p) => p.vendorId === "v_sharma" && p.status === "unpaid" && p.totalPaise === 1_240_000);
    expect(due).toBeTruthy();
    expect(due!.dueDate).toBe(istDayKey(addDays(NOW, 2)));
  });

  it("story: khata Ramesh 🟢 / Pooja 🟡 / Suresh 🔴 balances", () => {
    const bal = (key: string) =>
      snap.khata
        .filter((k) => k.customerId === `c_${key}`)
        .reduce((s, k) => s + (k.type === "credit" ? k.amountPaise : -k.amountPaise), 0);
    expect(bal("pooja")).toBe(90000);
    expect(bal("suresh")).toBe(240000);
    expect(bal("ramesh")).toBeLessThanOrEqual(25000);
    // Suresh: only ₹500 repaid
    const paid = snap.khata.filter((k) => k.customerId === "c_suresh" && k.type === "payment");
    expect(paid.reduce((s, k) => s + k.amountPaise, 0)).toBe(50000);
  });

  it("story: 12 regulars lapsed (≥4 visits in a 30d window, then absent 14+ days)", () => {
    const visits = new Map<string, number[]>();
    for (const t of snap.transactions)
      if (t.customerId) visits.set(t.customerId, [...(visits.get(t.customerId) ?? []), t.createdAt.getTime()]);
    const DAY = 86_400_000;
    let lapsed = 0;
    for (const c of snap.customers) {
      const v = (visits.get(c.id) ?? []).sort((a, b) => a - b);
      if (!v.length) continue;
      const last = v[v.length - 1];
      if (NOW.getTime() - last < 14 * DAY) continue;
      const regularBefore = v.some((x, i) => v.filter((y) => y >= x && y < x + 30 * DAY).length >= 4 && i >= 0);
      if (regularBefore) lapsed++;
    }
    expect(lapsed).toBe(12);
  });

  it("story: today so far is ~30% below a normal same weekday", () => {
    expect(istWeekday(NOW)).toBe(4);
    const cutoffMin = 15 * 60;
    const sum = (from: Date, to: Date) =>
      snap.transactions
        .filter((t) => t.kind === "sale" && t.createdAt >= from && t.createdAt <= to)
        .reduce((s, t) => s + t.amountPaise, 0);
    const today = sum(startOfIstDay(NOW), NOW);
    const prev: number[] = [];
    for (let w = 1; w <= 8; w++) {
      const d = addDays(startOfIstDay(NOW), -7 * w);
      prev.push(sum(d, new Date(d.getTime() + cutoffMin * 60_000)));
    }
    const mean = prev.reduce((a, b) => a + b, 0) / prev.length;
    const ratio = today / mean;
    expect(ratio).toBeGreaterThan(0.55);
    expect(ratio).toBeLessThan(0.85);
  });

  it("calendar has Diwali, Christmas, New Year, Makar Sankranti; Diwali uplift is visible", () => {
    expect(snap.festivals.map((f) => f.name)).toEqual(["Diwali", "Christmas", "New Year", "Makar Sankranti"]);
    const units = (from: string, to: string) =>
      snap.saleItems
        .filter((s) => {
          const k = istDayKey(s.createdAt);
          return k >= from && k <= to && snap.products.find((p) => p.id === s.productId)!.category === "sweets";
        })
        .reduce((s, i) => s + i.qty, 0);
    const diwaliWeek = units("2026-11-01", "2026-11-08") / 8;
    const before = units("2026-10-03", "2026-10-30") / 28;
    expect(diwaliWeek / before).toBeGreaterThan(1.8);
  });

  it("expenses: rent on the 5th, salary on the 1st", () => {
    expect(snap.expenses.some((e) => e.category === "rent" && e.amountPaise === 1_500_000)).toBe(true);
    expect(snap.expenses.some((e) => e.category === "salary" && e.amountPaise === 800_000)).toBe(true);
  });
});
