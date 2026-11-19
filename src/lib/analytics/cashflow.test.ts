import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { forecastRevenue, openPayables, projectCashFlow, recurringExpenses } from "./cashflow";

const NOW = new Date("2026-11-19T09:30:00Z");
const snap = generateSnapshot({ now: NOW });

describe("revenue forecast", () => {
  const rev = forecastRevenue(snap);
  it("14 days from tomorrow, upi + cash = total", () => {
    expect(rev).toHaveLength(14);
    expect(rev[0].date).toBe("2026-11-20");
    for (const r of rev) expect(r.upiPaise + r.cashPaise).toBe(r.totalPaise);
  });
  it("daily average is in the ~16k range with a ~70% UPI share", () => {
    const avg = rev.reduce((s, r) => s + r.totalPaise, 0) / 14;
    expect(avg).toBeGreaterThan(1_100_000);
    expect(avg).toBeLessThan(2_200_000);
    const upi = rev.reduce((s, r) => s + r.upiPaise, 0) / rev.reduce((s, r) => s + r.totalPaise, 0);
    expect(upi).toBeGreaterThan(0.6);
    expect(upi).toBeLessThan(0.8);
  });
});

describe("payables and recurring", () => {
  it("Sharma 12,400 is due in 2 days", () => {
    const p = openPayables(snap).find((x) => x.vendorId === "v_sharma" && x.amountPaise === 1_240_000)!;
    expect(p.dueInDays).toBe(2);
  });
  it("learns rent on 5th and salary on 1st", () => {
    const r = recurringExpenses(snap);
    expect(r.find((x) => x.category === "rent")).toMatchObject({ dayOfMonth: 5, amountPaise: 1_500_000 });
    expect(r.find((x) => x.category === "salary")).toMatchObject({ dayOfMonth: 1, amountPaise: 800_000 });
  });
});

describe("cash flow", () => {
  const flow = projectCashFlow(snap);
  it("series covers the horizon and cumulative = running sum of net", () => {
    expect(flow.series).toHaveLength(14);
    let run = snap.settings.cash.openingBalancePaise;
    for (const d of flow.series) {
      run += d.netPaise;
      expect(d.cumulativePaise).toBe(run);
    }
  });
  it("shows a cash shortfall of about 2-3k with suggestions (demo story)", () => {
    expect(flow.warnings.length).toBeGreaterThan(0);
    const w = flow.warnings.reduce((a, b) => (b.shortfallPaise > a.shortfallPaise ? b : a));
    expect(w.shortfallPaise).toBeGreaterThan(150_000);
    expect(w.shortfallPaise).toBeLessThan(400_000);
    expect(w.suggestions.map((s) => s.kind)).toContain("collect");
    expect(new Set(flow.warnings.map((x) => x.date)).size).toBe(flow.warnings.length);
  });
  it("no warning when the owner has plenty of opening cash", () => {
    expect(projectCashFlow({ ...snap, settings: { ...snap.settings, cash: { ...snap.settings.cash, openingBalancePaise: 50_000_000 } } }).warnings).toHaveLength(0);
  });
});
