import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { applySettingsPatch, DEFAULT_SETTINGS } from "../settings";
import { buildContext, detectRecommendations, topRecommendations } from "./recommendations";

const NOW = new Date("2026-11-19T09:30:00Z");
const snap = generateSnapshot({ now: NOW });
const tune = (patch: unknown) => {
  const r = applySettingsPatch(DEFAULT_SETTINGS, patch);
  if (!r.ok) throw new Error(r.error);
  return { ...snap, settings: r.settings };
};
const recs = detectRecommendations(snap);
const types = new Set(recs.map((r) => r.type));

describe("recommendations", () => {
  it("surfaces the planted demo stories", () => {
    for (const t of ["REORDER", "COLLECT_DUES", "STOP_CREDIT", "DEAD_STOCK_CLEAR", "OVERSTOCK"] as const) expect(types.has(t), t).toBe(true);
  });
  it("Suresh (red) gets STOP_CREDIT, Maggi gets REORDER", () => {
    expect(recs.some((r) => r.type === "STOP_CREDIT" && String(r.facts.customer).includes("Suresh"))).toBe(true);
    expect(recs.some((r) => r.type === "REORDER" && String(r.facts.item).includes("Maggi"))).toBe(true);
  });
  it("ids are unique and every rec has numbers computed by code", () => {
    expect(new Set(recs.map((r) => r.id)).size).toBe(recs.length);
    for (const r of recs) {
      expect(Number.isFinite(r.impactPaise)).toBe(true);
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });
  it("ranked by impact × confidence, pinned payables first", () => {
    const pinned = recs.filter((r) => r.pinned);
    expect(recs.slice(0, pinned.length).every((r) => r.pinned)).toBe(true);
    const rest = recs.filter((r) => !r.pinned);
    for (let i = 1; i < rest.length; i++) expect(rest[i - 1].score).toBeGreaterThanOrEqual(rest[i].score);
  });
  it("accepts a prebuilt context and returns the same list", () => {
    expect(detectRecommendations(snap, buildContext(snap)).map((r) => r.id)).toEqual(recs.map((r) => r.id));
  });
  it("topRecommendations honours the merchant's maxItems", () => {
    expect(topRecommendations(snap)).toHaveLength(Math.min(recs.length, DEFAULT_SETTINGS.recommendations.maxItems));
    expect(topRecommendations(tune({ recommendations: { maxItems: 3 } }))).toHaveLength(3);
  });
  it("merchant thresholds change what is flagged", () => {
    const strict = detectRecommendations(tune({ recommendations: { lowMarginPct: 50 } })).filter((r) => r.type === "LOW_MARGIN").length;
    const lax = recs.filter((r) => r.type === "LOW_MARGIN").length;
    expect(strict).toBeGreaterThanOrEqual(lax);
    const noUpi = detectRecommendations(tune({ recommendations: { cashShareMax: 1 } })).some((r) => r.type === "INCREASE_UPI_SHARE");
    expect(noUpi).toBe(false);
    const wider = detectRecommendations(tune({ recommendations: { pinDueDays: 14 } })).filter((r) => r.type === "PAYABLE_DUE").length;
    expect(wider).toBeGreaterThanOrEqual(recs.filter((r) => r.type === "PAYABLE_DUE").length);
  });
});
