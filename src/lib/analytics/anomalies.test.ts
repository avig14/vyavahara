import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { applySettingsPatch, DEFAULT_SETTINGS } from "../settings";
import { detectAnomalies, itemDropAnomalies, refundAnomaly, salesAnomaly } from "./anomalies";

const NOW = new Date("2026-11-19T09:30:00Z");
const snap = generateSnapshot({ now: NOW });

describe("anomalies", () => {
  it("flags today's ~30% sales dip", () => {
    const a = salesAnomaly(snap)!;
    expect(a).toBeTruthy();
    expect(a.kind).toBe("sales_dip");
    expect(a.z).toBeLessThanOrEqual(-1);
    expect(a.deltaPct).toBeLessThan(-0.15);
  });
  it("a stricter threshold from merchant settings silences it", () => {
    const r = applySettingsPatch(DEFAULT_SETTINGS, { anomalies: { zThreshold: 4 } });
    if (!r.ok) throw new Error(r.error);
    expect(salesAnomaly({ ...snap, settings: r.settings })).toBeNull();
  });
  it("no refund spike on a normal day", () => {
    expect(refundAnomaly(snap)).toBeNull();
  });
  it("detects an injected refund spike", () => {
    const tx = snap.transactions.find((t) => t.kind === "sale")!;
    const refund = { ...tx, id: "t_refund_x", kind: "refund" as const, amountPaise: 900_000, createdAt: new Date(NOW.getTime() - 3600_000) };
    const r = refundAnomaly({ ...snap, transactions: [...snap.transactions, refund] });
    expect(r?.kind).toBe("refund_spike");
  });
  it("item-drop detector returns only items that really fell and respects the threshold", () => {
    const base = itemDropAnomalies(snap);
    for (const d of base) expect(d.share).toBeLessThan(0.4);
    const r = applySettingsPatch(DEFAULT_SETTINGS, { anomalies: { itemDropShare: 0.9 } });
    if (!r.ok) throw new Error(r.error);
    expect(itemDropAnomalies({ ...snap, settings: r.settings }).length).toBeGreaterThanOrEqual(base.length);
  });
  it("detectAnomalies includes the sales dip first", () => {
    expect(detectAnomalies(snap)[0].kind).toBe("sales_dip");
  });
});
