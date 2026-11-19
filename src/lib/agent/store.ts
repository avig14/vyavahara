/** Write port for the agent. Real impl talks to Neon; tests use an in-memory fake. */
import type { Db } from "../db/client";
import * as q from "../db/queries";

export type Actor = "ai" | "owner" | "system";
export type ExpenseCategory = "rent" | "electricity" | "salary" | "transport" | "other";

export interface AgentStore {
  addKhataEntry(a: { customerId: string; type: "credit" | "payment"; amountPaise: number; note?: string }): Promise<void>;
  addExpense(a: { category: ExpenseCategory; amountPaise: number; note?: string }): Promise<void>;
  addCashSale(amountPaise: number): Promise<void>;
  adjustStock(a: { productId: string; delta: number; reason: "sale" | "purchase" | "adjust" }): Promise<void>;
  setCreditBlocked(customerId: string, blocked: boolean): Promise<void>;
  setCreditLimit(customerId: string, limitPaise: number): Promise<void>;
  createPurchaseOrder(vendorId: string, items: { productId: string; name: string; qty: number; unit: string }[]): Promise<void>;
  payVendorBill(purchaseId: string, amountPaise?: number): Promise<void>;
  receiveBill(b: q.BillReceipt): Promise<void>;
  createPending(kind: q.PendingKind, payload: unknown): Promise<string>;
}

export function dbStore(db: Db, merchantId: string, actor: Actor = "ai"): AgentStore {
  return {
    addKhataEntry: async (a) => void (await q.addKhataEntry(db, { merchantId, actor, source: "ai", ...a })),
    addExpense: async (a) => void (await q.addExpense(db, { merchantId, actor, ...a })),
    addCashSale: async (amountPaise) => void (await q.addCashSale(db, { merchantId, amountPaise, actor })),
    adjustStock: (a) => q.adjustStock(db, { merchantId, actor, ...a }),
    setCreditBlocked: (customerId, blocked) => q.setCreditBlocked(db, merchantId, customerId, blocked, actor),
    setCreditLimit: (customerId, limitPaise) => q.setCreditLimit(db, merchantId, customerId, limitPaise, actor),
    createPurchaseOrder: async (vendorId, items) => void (await q.createPurchaseOrder(db, { merchantId, vendorId, items, actor })),
    payVendorBill: async (purchaseId, amountPaise) => void (await q.payVendorBill(db, { merchantId, purchaseId, amountPaise, actor })),
    receiveBill: async (b) => void (await q.receiveBill(db, merchantId, b, "photo", "owner")),
    createPending: async (kind, payload) => (await q.createPendingAction(db, merchantId, kind, payload)).id,
  };
}

/**
 * Public demo (Soundbox on the landing page with SOUNDBOX_LANDING_READONLY=true): every direct write fails with a
 * message the agent can say. Confirmations can still be proposed; the voice route cancels them instead of applying.
 */
export function readOnlyStore(inner: AgentStore): AgentStore {
  const no = async () => {
    throw new Error("Demo mode: yahan se badlav save nahi hota. Dashboard ya WhatsApp se kijiye.");
  };
  return {
    addKhataEntry: no,
    addExpense: no,
    addCashSale: no,
    adjustStock: no,
    setCreditBlocked: no,
    setCreditLimit: no,
    createPurchaseOrder: no,
    payVendorBill: no,
    receiveBill: no,
    createPending: (kind, payload) => inner.createPending(kind, payload),
  };
}
