import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSnapshot } from "../seed/generate";
import type { Db } from "../db/client";

const now = new Date("2026-11-19T09:30:00Z");
const snap = generateSnapshot({ now });
const create = vi.fn(async (...args: unknown[]) => (void args, { id: "pend-1", expiresAt: new Date("2026-11-19T10:00:00Z") }));
vi.mock("../db/queries", () => ({ loadSnapshot: async () => snap, createPendingAction: (...a: unknown[]) => create(...a) }));

const { scanBill } = await import("./bill-scan");
const db = {} as Db;
const img = { base64: "AA==", mime: "image/jpeg" as const };

beforeEach(() => create.mockClear());

describe("scanBill: parks the bill for accept or reject, never saves it", () => {
  it("good read parks one stock_in for 30 minutes", async () => {
    const extract = async () => ({
      vendor_name: "Sharma Traders",
      invoice_no: "NEW-1",
      invoice_date: "2026-11-18",
      items: [{ name: "Maggi", qty: 10, unit: "pc", unit_price: 12, line_total: 120 }],
      total: 120,
    });
    const r = await scanBill(db, "m1", img, { now }, extract);
    expect(r.pendingId).toBe("pend-1");
    expect(r.review.verdict).toBe("good");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0].slice(2, 5)).toEqual(["stock_in", expect.objectContaining({ kind: "stock_in", totalPaise: 12000 }), 30]);
  });

  it("unreadable photo (model returns nothing) parks nothing and asks for a retake", async () => {
    const r = await scanBill(db, "m1", img, { now }, async () => null);
    expect(r.pendingId).toBeNull();
    expect(r.review.verdict).toBe("retake");
    expect(create).not.toHaveBeenCalled();
  });
});
