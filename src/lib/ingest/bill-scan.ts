/**
 * Bill photo → review for the owner. Nothing is saved to stock or payables here:
 * a pending `stock_in` action is parked (30 min) until the owner accepts (confirm) or rejects (cancel) it.
 * The same function serves the dashboard now and the WhatsApp bot later.
 */
import type { Db } from "../db/client";
import { createPendingAction, loadSnapshot } from "../db/queries";
import { planBill, type BillReview } from "./bill-plan";
import { extractBill, type Bill, type ImageInput } from "./vision";

export const BILL_HOLD_MINUTES = 30;

export interface BillScanResult {
  /** null when the bill cannot be saved as read (retake) */
  pendingId: string | null;
  expiresAt: string | null;
  review: BillReview;
}

const EMPTY_BILL: Bill = { vendor_name: null, invoice_no: null, invoice_date: null, items: [], total: null };

export async function scanBill(
  db: Db,
  merchantId: string,
  image: ImageInput,
  opts: { vendorId?: string | null; now?: Date } = {},
  extract: (i: ImageInput) => Promise<Bill | null> = (i) => extractBill(i),
): Promise<BillScanResult> {
  const now = opts.now ?? new Date();
  const bill = (await extract(image)) ?? EMPTY_BILL; // refusal or unreadable → same as "nothing read": retake
  const snap = await loadSnapshot(db, merchantId, { now });
  const { review, payload } = planBill(bill, snap, { vendorId: opts.vendorId, now });
  if (!payload) return { pendingId: null, expiresAt: null, review };
  const row = await createPendingAction(db, merchantId, "stock_in", payload, BILL_HOLD_MINUTES, now);
  return { pendingId: row.id, expiresAt: row.expiresAt.toISOString(), review };
}
