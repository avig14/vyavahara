import { describe, expect, it } from "vitest";
import type { Product } from "../domain";
import { planPayment, planUtterance, type HeldBasket } from "./flow";
import { upiUri } from "../pay";

const prod = (id: string, name: string, pricePaise: number, stockQty: number, aliases: string[] = []): Product => ({
  id,
  sku: id,
  name,
  aliases,
  category: "grocery",
  unit: "pc",
  packSize: 1,
  pricePaise,
  costPaise: Math.round(pricePaise * 0.8),
  gstRate: 0,
  stockQty,
  isActive: true,
});

const products = [prod("maggi", "Maggi Noodles", 1400, 10, ["maggi"]), prod("amul", "Amul Butter", 5800, 0, ["butter"]), prod("old", "Old Item", 100, 5)];

describe("planUtterance", () => {
  it("matches items, flags unknown, and turns out-of-stock into lost demand", () => {
    const plan = planUtterance(products, { intent: "purchase", asked_availability: false, items: [{ name: "maggi", qty: 2 }, { name: "butter", qty: 1 }, { name: "zzzz qqqq", qty: 1 }] }, 0.35);
    expect(plan.matched.map((m) => m.productId)).toEqual(["maggi", "amul"]);
    expect(plan.unmatched).toEqual(["zzzz qqqq"]);
    expect(plan.lost).toEqual([{ productId: "amul", name: "Amul Butter", qty: 1, estValuePaise: 5800 }]);
  });

  it("qty 0 or missing counts as one", () => {
    const plan = planUtterance(products, { intent: "purchase", asked_availability: false, items: [{ name: "maggi", qty: 0 }] }, 0.35);
    expect(plan.matched[0].qty).toBe(1);
  });

  it("ignores inactive products", () => {
    const off = [{ ...products[0], isActive: false }];
    expect(planUtterance(off, { intent: "purchase", asked_availability: false, items: [{ name: "maggi", qty: 1 }] }, 0.35).matched).toEqual([]);
  });
});

describe("planPayment", () => {
  const basket = (id: string, items: [string, number, number][]): HeldBasket => ({
    id,
    items: items.map(([productId, qty, pricePaise]) => ({ productId, name: productId, qty, pricePaise, costPaise: Math.round(pricePaise * 0.8) })),
  });

  it("exact match is confirmed and closes the baskets", () => {
    const r = planPayment([basket("e1", [["maggi", 2, 1400], ["amul", 1, 5800]])], 8600, 2);
    expect(r.matchedBasket).toBe(true);
    expect(r.confidence).toBe("confirmed");
    expect(r.lines.map((l) => [l.productId, l.qty])).toEqual([["maggi", 2], ["amul", 1]]);
    expect(r.eventIds).toEqual(["e1"]);
  });

  it("customer dropped an item: pays for a subset", () => {
    const r = planPayment([basket("e1", [["maggi", 2, 1400], ["amul", 1, 5800]])], 5800, 2);
    expect(r.lines).toEqual([expect.objectContaining({ productId: "amul", qty: 1 })]);
  });

  it("merges baskets heard separately", () => {
    const r = planPayment([basket("e1", [["maggi", 1, 1400]]), basket("e2", [["maggi", 1, 1400]])], 2800, 2);
    expect(r.lines[0].qty).toBe(2);
    expect(r.eventIds).toEqual(["e1", "e2"]);
  });

  it("small gap inside tolerance is probable, not confirmed", () => {
    const r = planPayment([basket("e1", [["maggi", 1, 1400]])], 1390, 2);
    expect(r.matchedBasket).toBe(true);
    expect(r.confidence).toBe("probable");
  });

  it("tolerance is the merchant's setting", () => {
    expect(planPayment([basket("e1", [["maggi", 1, 1400]])], 1390, 0.1).matchedBasket).toBe(false);
  });

  it("no basket or no fit: payment only, no items", () => {
    expect(planPayment([], 5000, 2).matchedBasket).toBe(false);
    const r = planPayment([basket("e1", [["maggi", 1, 1400]])], 99_900, 2);
    expect(r.lines).toEqual([]);
    expect(r.eventIds).toEqual([]);
  });
});

describe("upiUri", () => {
  it("builds the NPCI link with rupees to 2 decimals", () => {
    const u = upiUri({ vpa: "shop@paytm", name: "Gupta Kirana", amountPaise: 12_850, note: "Khata payment" });
    expect(u).toBe("upi://pay?pa=shop%40paytm&pn=Gupta%20Kirana&am=128.50&cu=INR&tn=Khata%20payment");
  });
  it("rejects non-positive or fractional paise", () => {
    expect(() => upiUri({ vpa: "a@b", name: "x", amountPaise: 0 })).toThrow();
    expect(() => upiUri({ vpa: "a@b", name: "x", amountPaise: 10.5 })).toThrow();
  });
});
