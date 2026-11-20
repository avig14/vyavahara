import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { buildContext } from "../analytics/recommendations";
import { khataOverview } from "../analytics/khata-risk";
import { buildCardData, dailyCardData, stockCardData, udhaarCardData } from "./cards-data";
import { imagesFor } from "./media";
import { rupees } from "../format";
import { istDayKey, istDayStart } from "../time";

const snap = generateSnapshot({ now: new Date("2026-11-19T09:30:00Z") });

describe("daily card", () => {
  it("adds up: total = upi + cash, rows are the latest sales of that day", () => {
    const d = dailyCardData(snap);
    expect(d.totalPaise).toBe(d.upiPaise + d.cashPaise);
    expect(d.rows.length).toBeLessThanOrEqual(5);
    expect(d.rows.length).toBeGreaterThan(0);
    expect(d.udhaarPaise).toBe(khataOverview(snap).totalOutstandingPaise);
  });
  it("before the first sale of the day it shows the last day with sales, and says so", () => {
    const sales = snap.transactions.filter((t) => t.kind === "sale");
    const last = sales.reduce((x, y) => (x.createdAt > y.createdAt ? x : y));
    const key = istDayKey(last.createdAt);
    const earlyNextMorning = new Date(istDayStart(key).getTime() + 27 * 3_600_000); // 03:00 IST the next day
    const d = dailyCardData({ ...snap, now: earlyNextMorning });
    expect(d.dayLabel).toBe("Kal");
    expect(d.title).toBe("Kal ka hisaab");
    expect(d.totalPaise).toBe(sales.filter((t) => istDayKey(t.createdAt) === key).reduce((n, t) => n + t.amountPaise, 0));
  });
  it("says Aaj when today has sales", () => {
    const todaySales = snap.transactions.filter((t) => t.kind === "sale");
    const last = todaySales.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    const d = dailyCardData({ ...snap, now: new Date(last.createdAt.getTime() + 60_000) });
    expect(d.dayLabel).toBe("Aaj");
    expect(d.title).toBe("Aaj ka hisaab");
  });
});

describe("udhaar card", () => {
  it("picks the most urgent customer and drafts the reminder with exact numbers", () => {
    const d = udhaarCardData(snap);
    const accts = khataOverview(snap).accounts;
    if (accts.length === 0) return expect(d.none).toBe(true);
    expect(d.none).toBe(false);
    const a = accts.find((x) => x.name === d.customer)!;
    expect(d.amountPaise).toBe(a.outstandingPaise);
    expect(d.days).toBe(a.oldestUnpaidDays);
    expect(d.draft).toContain(rupees(a.outstandingPaise));
    expect(d.draft).toContain(`${a.oldestUnpaidDays} din`);
    expect(d.draft).toContain(snap.merchant.name);
  });
  it("handles nobody owing", () => {
    expect(udhaarCardData({ ...snap, khata: [] }).none).toBe(true);
  });
});

describe("stock card", () => {
  it("picks the item that runs out first and names a supplier", () => {
    const ctx = buildContext(snap);
    const d = stockCardData(snap, ctx);
    const urgent = ctx.forecasts.filter((f) => f.status === "stockout" || f.status === "reorder").sort((a, b) => a.daysToStockout - b.daysToStockout)[0];
    if (!urgent) return expect(d.none).toBe(true);
    expect(d.item).toBe(urgent.name);
    expect(d.draft).toContain(urgent.name);
    expect(d.meter).toBeGreaterThanOrEqual(0);
    expect(d.meter).toBeLessThanOrEqual(100);
    expect(d.out).toBe(urgent.stock <= 0);
  });
  it("buildCardData dispatches by kind", () => {
    expect(buildCardData(snap, "daily")).toHaveProperty("totalPaise");
    expect(buildCardData(snap, "udhaar")).toHaveProperty("draft");
    expect(buildCardData(snap, "stock")).toHaveProperty("meter");
  });
});

describe("photos with replies", () => {
  it("welcome banner on the menu, cards on report, udhaar and stock, none elsewhere", () => {
    expect(imagesFor("menu")[0].src).toBe("/wa/welcome.png");
    expect(imagesFor("4.1", 1)[0].src).toBe("/api/wa/card/daily?v=1");
    expect(imagesFor("3.1", 1)[0].src).toBe("/api/wa/card/udhaar?v=1");
    expect(imagesFor("1.1", 1)[0].src).toBe("/api/wa/card/stock?v=1");
    for (const k of ["2.6", "3.7", "4.8", "5.7", "module:2", null]) expect(imagesFor(k)).toEqual([]);
    for (const k of ["menu", "4.1", "3.1", "1.1"]) for (const m of imagesFor(k)) { expect(m.alt.length).toBeGreaterThan(5); expect((m.caption ?? "").length).toBeLessThanOrEqual(1024); }
  });
});
