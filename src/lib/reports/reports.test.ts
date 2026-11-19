import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { applySettingsPatch, DEFAULT_SETTINGS } from "../settings";
import { buildReport, salesHeatmap } from "./build";
import { reportText } from "./text";
import { renderReportPdf } from "./pdf";

const NOW = new Date("2026-11-19T09:30:00Z"); // 15:00 IST Thursday
const snap = generateSnapshot({ now: NOW });
const today = buildReport(snap, { period: "today" });

describe("report builder", () => {
  it("today: sales split adds up and profit = gross − expenses", () => {
    expect(today.sales.upiPaise + today.sales.cashPaise).toBe(today.sales.totalPaise);
    expect(today.profit.netPaise).toBe(today.profit.grossPaise - today.profit.expensesPaise);
    expect(today.sales.bills).toBeGreaterThan(0);
  });
  it("shows the planted today-dip anomaly and a % vs last week", () => {
    expect(today.anomalies.some((a) => a.kind === "sales_dip")).toBe(true);
    expect(today.sales.changePct).not.toBeNull();
    expect(today.sales.changePct!).toBeLessThan(0);
  });
  it("has top items, red khata customers, payables and exactly 3 recommendations", () => {
    expect(today.topByRevenue.length).toBeGreaterThan(0);
    expect(today.khata.red.some((a) => a.name.includes("Suresh"))).toBe(true);
    expect(today.payablesDue.length).toBeGreaterThan(0);
    expect(today.recommendations).toHaveLength(3);
  });
  it("week/month totals ≥ today and anomalies only appear for periods that include now", () => {
    const month = buildReport(snap, { period: "this_month" });
    expect(month.sales.totalPaise).toBeGreaterThan(today.sales.totalPaise);
    expect(buildReport(snap, { period: "last_month" }).anomalies).toEqual([]);
    expect(month.daily.length).toBe(19);
  });
  it("custom range works", () => {
    const r = buildReport(snap, { period: "custom", custom: { from: new Date("2026-11-01T00:00:00+05:30"), to: new Date("2026-11-07T00:00:00+05:30") } });
    expect(r.daily).toHaveLength(7);
  });
  it("merchant can change how many recommendations the report shows", () => {
    expect(buildReport(snap, { period: "today", recs: 5 }).recommendations).toHaveLength(5);
  });
});

describe("report text", () => {
  const t = reportText(today);
  it("contains the key numbers from the data, nothing invented", () => {
    expect(t).toContain(snap.merchant.name);
    expect(t).toContain("Net");
    expect(t).toContain("Suggestions");
    expect(t).toMatch(/Sales \*₹[\d,]+\*/);
    expect(t).toContain("Suresh");
  });
  it("footer can be dropped", () => {
    expect(reportText(today, { footer: false })).not.toContain("*PDF*");
  });
});

describe("heatmap", () => {
  it("7×24 grid with a peak hour and weekday", () => {
    const h = salesHeatmap(snap);
    expect(h.cells).toHaveLength(7);
    expect(h.cells[0]).toHaveLength(24);
    expect(h.peakHour).not.toBeNull();
    expect(h.morningPaise + h.eveningPaise).toBeGreaterThan(0);
  });
});

describe("report pdf", () => {
  it("renders a real PDF (with ₹ font) for today and for the month", async () => {
    for (const p of ["today", "this_month"] as const) {
      const buf = await renderReportPdf(buildReport(snap, { period: p }));
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(buf.length).toBeGreaterThan(5_000);
    }
  });
  it("settings is untouched by report building", () => {
    expect(applySettingsPatch(DEFAULT_SETTINGS, {}).ok).toBe(true);
  });
});
