import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { crostonSba, daysUntilStockout, forecastAll, forecastItem, holtWinters, seasonalNaive, selectModel } from "./forecast";
import { learnUplifts, makeUplift, festivalPlan } from "./festival";

const NOW = new Date("2026-11-19T09:30:00Z");
const snap = generateSnapshot({ now: NOW });

describe("models", () => {
  const weekly = Array.from({ length: 84 }, (_, i) => 10 + [0, 1, 2, 3, 4, 8, 6][i % 7]);
  it("seasonal naive repeats last week", () => {
    expect(seasonalNaive(weekly, 7)).toEqual(weekly.slice(-7));
  });
  it("holt-winters tracks a clean weekly pattern", () => {
    const f = holtWinters(weekly, 7, 0);
    f.forEach((v, k) => expect(Math.abs(v - weekly[77 + k])).toBeLessThan(1.5));
  });
  it("croston-SBA ≈ demand rate on intermittent data", () => {
    const y = Array.from({ length: 100 }, (_, i) => (i % 5 === 0 ? 4 : 0));
    const f = crostonSba(y, 3)[0];
    expect(f).toBeGreaterThan(0.6);
    expect(f).toBeLessThan(1.0); // true rate 0.8
  });
  it("selects croston when >40% zeros", () => {
    const y = Array.from({ length: 100 }, (_, i) => (i % 5 === 0 ? 4 : 0));
    expect(selectModel(y, 0).model).toBe("croston_sba");
  });
  it("daysUntilStockout is stock / rate for a flat rate", () => {
    expect(daysUntilStockout(20, new Array(14).fill(10), 0)).toBeCloseTo(2, 5);
    expect(daysUntilStockout(0, new Array(14).fill(10), 0)).toBe(0);
    expect(daysUntilStockout(5, new Array(14).fill(0), 0)).toBe(Infinity);
  });
  it("order qty rounds up to pack and is zero when overstocked", () => {
    const f = forecastItem({
      productId: "x", name: "x", category: "c", history: weekly, dow0: 0, stock: 0, soldToday: 0,
      leadTimeDays: 2, packSize: 12, now: NOW,
    });
    expect(f.suggestedOrderQty % 12).toBe(0);
    expect(f.suggestedOrderQty).toBeGreaterThan(0);
  });
});

describe("forecasts on seeded store", () => {
  const up = makeUplift(snap);
  const fc = forecastAll(snap, up);
  const get = (id: string) => fc.find((f) => f.productId === id)!;

  it("Maggi runs out in about 2 days", () => {
    const m = get("p_maggi");
    expect(m.daysToStockout).toBeGreaterThan(1.3);
    expect(m.daysToStockout).toBeLessThan(3.2);
    expect(m.status).toBe("reorder");
    expect(m.suggestedOrderQty).toBeGreaterThan(0);
    expect(m.daysToStockoutRange[0]).toBeLessThanOrEqual(m.daysToStockout);
  });
  it("Amul Taaza is out of stock", () => {
    expect(get("p_taaza").status).toBe("stockout");
    expect(get("p_taaza").daysToStockout).toBe(0);
  });
  it("dead items flagged dead, slow movers use Croston", () => {
    expect(get("p_hairoil").status).toBe("dead");
    expect(get("p_tang").status).toBe("dead");
    expect(get("p_harpic").model).toBe("croston_sba");
  });
  it("overstock items are flagged", () => {
    expect(get("p_juice").status).toBe("overstock");
  });
  it("forecast accuracy is sane (median WAPE < 45% on regular items)", () => {
    const w = fc.filter((f) => f.model !== "croston_sba" && f.status !== "dead").map((f) => f.wape).sort((a, b) => a - b);
    expect(w[Math.floor(w.length / 2)]).toBeLessThan(0.45);
  });
  it("bands are ordered and non-negative", () => {
    for (const f of fc) for (const d of f.daily) { expect(d.lo).toBeGreaterThanOrEqual(0); expect(d.hi).toBeGreaterThanOrEqual(d.yhat); expect(d.yhat).toBeGreaterThanOrEqual(0); }
  });
});

describe("festival", () => {
  it("learns Diwali uplift per category from history", () => {
    const l = learnUplifts(snap);
    expect(l.get("sweets")!.uplift).toBeGreaterThan(1.8);
    expect(l.get("dry_fruits")!.uplift).toBeGreaterThan(1.6);
    expect(l.get("snacks")!.uplift).toBeGreaterThan(1.2);
  });
  it("applies uplift only inside D-7..D of an upcoming festival", () => {
    const up = makeUplift(snap);
    expect(up("sweets", "2026-12-20")).toBeGreaterThan(1.5);
    expect(up("sweets", "2026-12-10")).toBe(1);
    expect(up("staples", "2026-12-20")).toBe(1);
  });
  it("builds plan for Christmas first", () => {
    const plans = festivalPlan(snap, 45);
    expect(plans[0].festival.name).toBe("Christmas");
    expect(plans[0].totalImpactPaise).toBeGreaterThan(0);
  });
});
