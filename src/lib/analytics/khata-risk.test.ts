import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { fifoOpenCredits, findAccountByName, khataOverview } from "./khata-risk";

const NOW = new Date("2026-11-19T09:30:00Z");
const snap = generateSnapshot({ now: NOW });
const ov = khataOverview(snap);
const acc = (id: string) => ov.accounts.find((a) => a.customerId === id)!;

describe("khata risk", () => {
  it("Ramesh green", () => {
    expect(acc("c_ramesh").band).toBe("green");
    expect(acc("c_ramesh").score).toBeLessThanOrEqual(30);
  });
  it("Pooja amber, 900 rupees, 20 days", () => {
    const a = acc("c_pooja");
    expect(a.band).toBe("amber");
    expect(a.outstandingPaise).toBe(90000);
    expect(a.oldestUnpaidDays).toBe(20);
  });
  it("Suresh red, 2400 rupees, oldest 52 days", () => {
    const a = acc("c_suresh");
    expect(a.band).toBe("red");
    expect(a.outstandingPaise).toBe(240000);
    expect(a.oldestUnpaidDays).toBe(52);
    expect(a.suggestedLimitPaise).toBe(0);
    expect(a.reasons.length).toBeGreaterThan(0);
    expect(a.reasons.length).toBeLessThanOrEqual(3);
  });
  it("only Suresh is red and he is first", () => {
    expect(ov.accounts.filter((a) => a.band === "red").map((a) => a.customerId)).toEqual(["c_suresh"]);
    expect(ov.accounts[0].customerId).toBe("c_suresh");
  });
  it("ageing buckets add up to outstanding", () => {
    const a = acc("c_suresh");
    expect(a.ageing.d0_15 + a.ageing.d16_30 + a.ageing.d31_60 + a.ageing.d60p).toBe(a.outstandingPaise);
  });
  it("FIFO clears oldest credits first", () => {
    const d = (n: number) => new Date(Date.UTC(2026, 0, n));
    const base = { customerId: "c", note: null, source: null };
    const open = fifoOpenCredits([
      { ...base, id: "1", type: "credit", amountPaise: 100, createdAt: d(1) },
      { ...base, id: "2", type: "credit", amountPaise: 100, createdAt: d(2) },
      { ...base, id: "3", type: "payment", amountPaise: 150, createdAt: d(3) },
    ] as never);
    expect(open).toHaveLength(1);
    expect(open[0].remaining).toBe(50);
    expect(open[0].at).toEqual(d(2));
  });
  it("finds by first name", () => {
    expect(findAccountByName(ov.accounts, "suresh")?.customerId).toBe("c_suresh");
    expect(findAccountByName(ov.accounts, "nobody")).toBeNull();
  });
});
