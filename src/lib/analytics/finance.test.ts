import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { applySettingsPatch, DEFAULT_SETTINGS } from "../settings";
import { segmentCustomers } from "./segments";
import { gstSummary, quarterOf } from "./gst";
import { checkLoan } from "./loan";

const NOW = new Date("2026-11-19T09:30:00Z");
const snap = generateSnapshot({ now: NOW });
const tune = (patch: unknown) => {
  const r = applySettingsPatch(DEFAULT_SETTINGS, patch);
  if (!r.ok) throw new Error(r.error);
  return { ...snap, settings: r.settings };
};

describe("segments", () => {
  const seg = segmentCustomers(snap);
  it("finds the 12 lapsed regulars", () => {
    expect(seg.counts.lapsed).toBe(12);
    expect(seg.lapsed).toHaveLength(12);
  });
  it("has regulars and new customers", () => {
    expect(seg.counts.regular).toBeGreaterThanOrEqual(10);
    expect(seg.counts.new).toBeGreaterThanOrEqual(1);
  });
  it("lapsed list is sorted by lifetime spend", () => {
    for (let i = 1; i < seg.lapsed.length; i++) expect(seg.lapsed[i - 1].lifetimePaise).toBeGreaterThanOrEqual(seg.lapsed[i].lifetimePaise);
  });
  it("merchant can tighten what counts as regular", () => {
    expect(segmentCustomers(tune({ customers: { regularVisits: 12 } })).counts.regular).toBeLessThan(seg.counts.regular);
  });
});

describe("gst", () => {
  it("quarter helper: Nov 2026 → Q3 FY2026-27 (Oct–Dec)", () => {
    expect(quarterOf(NOW)).toMatchObject({ from: "2026-10-01", to: "2026-12-31", label: "Q3 FY2026-27" });
  });
  it("composition = 1% of quarter turnover, and the rate is configurable", () => {
    const g = gstSummary(snap);
    expect(g.scheme).toBe("composition");
    expect(g.turnoverPaise).toBeGreaterThan(0);
    expect(g.compositionTaxPaise).toBe(Math.round(g.turnoverPaise * 0.01));
    expect(gstSummary(tune({ gst: { compositionRatePct: 2 } })).compositionTaxPaise).toBe(Math.round(g.turnoverPaise * 0.02));
  });
  it("regular dealer: slab tax is value × r/(1+r) and input credit comes from purchases", () => {
    const g = gstSummary({ ...snap, merchant: { ...snap.merchant, gstScheme: "regular" } });
    expect(g.slabs!.length).toBeGreaterThan(2);
    for (const s of g.slabs!) {
      const exact = (s.grossPaise * s.ratePct) / (100 + s.ratePct);
      expect(Math.abs(s.outputTaxPaise - exact)).toBeLessThanOrEqual(exact * 0.002 + 1); // per-line rounding
      expect(s.taxablePaise + s.outputTaxPaise).toBe(s.grossPaise);
    }
    expect(g.inputTaxPaise).toBeGreaterThan(0);
    expect(g.netPayablePaise).toBe(g.outputTaxPaise! - g.inputTaxPaise!);
    expect(g.disclaimer).toMatch(/CA/);
  });
});

describe("loan", () => {
  const l = checkLoan(snap);
  it("demo shop: ~3.4L/month UPI and steady → may be eligible", () => {
    expect(l.avgMonthlyUpiPaise).toBeGreaterThan(30_000_000);
    expect(l.cv).toBeLessThan(0.4);
    expect(l.eligible).toBe(true);
    expect(l.indicativeMaxPaise).toBeGreaterThan(0);
    expect(l.disclaimer).toMatch(/KFS/);
  });
  it("merchant's own rules can flip the answer", () => {
    expect(checkLoan(tune({ loan: { minMonthlyUpiPaise: 100_000_000_00 } })).eligible).toBe(false);
    expect(checkLoan(tune({ loan: { rangeMultiple: 2 } })).indicativeMaxPaise).toBeGreaterThan(l.indicativeMaxPaise);
  });
});
