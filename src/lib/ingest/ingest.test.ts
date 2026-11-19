import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { applySettingsPatch, DEFAULT_SETTINGS } from "../settings";
import { buildMatcher } from "./match";
import { findPayment, reconcileBasket } from "./reconcile";
import { classifyImage, extractBill, parseSoundbox, validateBill, type Bill } from "./vision";

const snap = generateSnapshot({ now: new Date("2026-11-19T09:30:00Z") });
const cfg = snap.settings.ingest;

describe("match", () => {
  const m = buildMatcher(snap.products, cfg.matchMaxScore);
  it("matches Hinglish aliases and typos", () => {
    expect(m.match("maggi")?.product.name).toMatch(/Maggi/i);
    expect(m.match("magi noodles")?.product.name).toMatch(/Maggi/i);
    expect(m.match("parle g")?.product.name).toMatch(/Parle/i);
    expect(m.match("amul taza")?.product.name).toMatch(/Taaza/i);
  });
  it("returns null for gibberish and respects a stricter threshold", () => {
    expect(m.match("xyzzy qwerty")).toBeNull();
    expect(buildMatcher(snap.products, 0.05).match("magi noodle")).toBeNull();
  });
});

describe("reconcileBasket", () => {
  const basket = [
    { productId: "maggi", name: "Maggi", qty: 2, pricePaise: 1400 },
    { productId: "biscuit", name: "Parle-G", qty: 1, pricePaise: 1000 },
  ];
  it("exact: ₹28 → 2 Maggi", () => {
    const r = reconcileBasket(basket, 2800, 5)!;
    expect(r.lines).toEqual([{ productId: "maggi", name: "Maggi", qty: 2, pricePaise: 1400 }]);
    expect(r.errorFrac).toBe(0);
  });
  it("whole basket: ₹38 → both", () => {
    expect(reconcileBasket(basket, 3800, 5)!.lines).toHaveLength(2);
  });
  it("within ±5% matches, outside does not, and tolerance is a setting", () => {
    expect(reconcileBasket(basket, 2900, 5)).not.toBeNull(); // 2800 vs 2900 = 3.4%
    expect(reconcileBasket(basket, 3100, 5)).toBeNull(); // nearest is 2800 (9.7%)
    expect(reconcileBasket(basket, 3100, 12)).not.toBeNull();
  });
  it("empty / bad input", () => {
    expect(reconcileBasket([], 100, 5)).toBeNull();
    expect(reconcileBasket(basket, 0, 5)).toBeNull();
  });
});

describe("findPayment", () => {
  const t = snap.transactions.find((x) => x.method === "upi" && x.kind === "sale" && x.utr)!;
  it("UTR match", () => {
    const r = findPayment(snap, { amountPaise: null, utr: t.utr, at: null }, 30);
    expect(r.found && r.txn.id).toBe(t.id);
  });
  it("amount + time window", () => {
    const hit = findPayment(snap, { amountPaise: t.amountPaise, utr: null, at: new Date(t.createdAt.getTime() + 5 * 60_000) }, 30);
    expect(hit.found).toBe(true);
    const far = findPayment(snap, { amountPaise: t.amountPaise, utr: null, at: new Date(t.createdAt.getTime() + 3 * 86_400_000) }, 30);
    expect(far.found && far.txn.createdAt.getTime() === t.createdAt.getTime()).toBe(false);
  });
  it("unreadable and no-match", () => {
    expect(findPayment(snap, { amountPaise: null, utr: null, at: null }, 30)).toEqual({ found: false, reason: "unreadable" });
    expect(findPayment(snap, { amountPaise: 123_456_789, utr: "NOPE", at: null }, 30)).toEqual({ found: false, reason: "no_match" });
  });
});

describe("validateBill", () => {
  const bill: Bill = {
    vendor_name: "Sharma Traders",
    invoice_no: "INV-1",
    invoice_date: "2026-11-18",
    items: [
      { name: "Maggi", qty: 10, unit: "pc", unit_price: 12, line_total: 120 },
      { name: "Parle-G", qty: 5, unit: "pc", unit_price: 8, line_total: 40 },
    ],
    total: 160,
  };
  it("passes when lines add up", () => expect(validateBill(bill, 2).ok).toBe(true));
  it("flags a mismatch beyond the merchant's tolerance only", () => {
    const off = { ...bill, total: 170 }; // 5.9%
    expect(validateBill(off, 2).ok).toBe(false);
    expect(validateBill(off, 10).ok).toBe(true);
  });
  it("flags unreadable total and lines", () => {
    expect(validateBill({ ...bill, total: null }, 2).problems.join()).toMatch(/total/);
    expect(validateBill({ ...bill, items: [{ name: "X", qty: 1, unit: null, unit_price: null, line_total: null }] }, 2).ok).toBe(false);
  });
  it("tolerance is settable", () => {
    const r = applySettingsPatch(DEFAULT_SETTINGS, { ingest: { billTolerancePct: 0 } });
    expect(r.ok && r.settings.ingest.billTolerancePct).toBe(0);
  });
});

describe("vision calls (fake client)", () => {
  const fake = (parsed: unknown, stop = "end_turn") =>
    ({ messages: { parse: async () => ({ stop_reason: stop, parsed_output: parsed }) } }) as never;
  const image = { base64: "AAAA", mime: "image/jpeg" as const };
  it("returns parsed output", async () => {
    expect((await extractBill(image, fake({ items: [], total: null, vendor_name: null, invoice_no: null, invoice_date: null })))?.items).toEqual([]);
    expect(await classifyImage(image, fake({ kind: "supplier_bill" }))).toBe("supplier_bill");
    expect((await parseSoundbox("do maggi", fake({ intent: "purchase", items: [{ name: "maggi", qty: 2 }], asked_availability: false })))?.items[0].qty).toBe(2);
  });
  it("refusal / null → null (or 'other' for classify)", async () => {
    expect(await extractBill(image, fake(null, "refusal"))).toBeNull();
    expect(await classifyImage(image, fake(null))).toBe("other");
  });
});
