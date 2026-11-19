import { describe, expect, it } from "vitest";
import { applySettingsPatch, DEFAULT_SETTINGS, resolveSettings } from "./settings";
import { generateSnapshot } from "./seed/generate";
import { khataOverview } from "./analytics/khata-risk";
import { forecastAll } from "./analytics/forecast";
import { allFestivals } from "./analytics/festival";
import { projectCashFlow } from "./analytics/cashflow";

const NOW = new Date("2026-11-19T09:30:00Z");
const base = generateSnapshot({ now: NOW });
const withSettings = (patch: unknown) => {
  const r = applySettingsPatch(DEFAULT_SETTINGS, patch);
  if (!r.ok) throw new Error(r.error);
  return { ...base, settings: r.settings };
};

describe("merchant settings", () => {
  it("empty / garbage input falls back to defaults", () => {
    expect(resolveSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({ inventory: { serviceLevelZ: "high" } })).toEqual(DEFAULT_SETTINGS);
  });
  it("partial patch deep-merges and keeps other keys", () => {
    const r = applySettingsPatch(DEFAULT_SETTINGS, { khata: { weights: { oldest: 50 } } });
    expect(r.ok && r.settings.khata.weights.oldest).toBe(50);
    expect(r.ok && r.settings.khata.weights.repay).toBe(25);
    expect(r.ok && r.settings.inventory.horizonDays).toBe(14);
  });
  it("rejects out-of-range and inconsistent values", () => {
    expect(applySettingsPatch(DEFAULT_SETTINGS, { inventory: { serviceLevelZ: 9 } }).ok).toBe(false);
    expect(applySettingsPatch(DEFAULT_SETTINGS, { khata: { greenMax: 50, amberMax: 40 } }).ok).toBe(false);
    expect(applySettingsPatch(DEFAULT_SETTINGS, { alerts: { sendFromHour: 22, sendUntilHour: 21 } }).ok).toBe(false);
  });
  it("stricter khata bands change a customer's band", () => {
    const pooja = (s: typeof base) => khataOverview(s).accounts.find((a) => a.customerId === "c_pooja")!;
    expect(pooja(base).band).toBe("amber");
    expect(pooja(withSettings({ khata: { greenMax: 5, amberMax: 20 } })).band).toBe("red");
    expect(pooja(withSettings({ khata: { greenMax: 59, amberMax: 90 } })).band).toBe("green");
  });
  it("higher service level raises safety stock; shorter dead-stock window flags more", () => {
    const get = (s: typeof base, id: string) => forecastAll(s).find((f) => f.productId === id)!;
    expect(get(withSettings({ inventory: { serviceLevelZ: 2.5 } }), "p_maggi").safetyStock).toBeGreaterThan(
      get(base, "p_maggi").safetyStock,
    );
    expect(get(withSettings({ inventory: { overstockCoverDays: 14 } }), "p_toordal").status).toBe("overstock");
  });
  it("custom recurring expenses and opening balance drive cash flow", () => {
    const flow = projectCashFlow(
      withSettings({ cash: { recurring: [{ label: "Shop loan EMI", amountPaise: 500000, dayOfMonth: 25 }], openingBalancePaise: 1_000_000 } }),
    );
    expect(flow.series.find((d) => d.date === "2026-11-25")!.outflowExpensesPaise).toBe(500000);
    expect(flow.series.every((d) => d.date !== "2026-12-01" || d.outflowExpensesPaise === 0)).toBe(true);
    expect(flow.series[0].cumulativePaise).toBe(1_000_000 + flow.series[0].netPaise);
  });
  it("merchant festivals merge into the calendar", () => {
    const s = withSettings({ festivals: [{ name: "Shop Anniversary", date: "2026-12-10", categories: ["snacks"] }] });
    expect(allFestivals(s).some((f) => f.name === "Shop Anniversary")).toBe(true);
    expect(allFestivals(s).length).toBe(base.festivals.length + 1);
  });
  it("custom horizon sets forecast length", () => {
    expect(projectCashFlow(withSettings({ inventory: { horizonDays: 21 } })).series).toHaveLength(21);
  });
});
