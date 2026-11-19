import type { Payable, PriceChange, Recommendation, Vendor, VendorsPayload } from "./types";

export interface SupplierRow {
  vendor: Vendor;
  bills: Payable[];
  outstandingPaise: number;
  /** the soonest bill; null when nothing is owed */
  next: Payable | null;
  /** the API flagged this bill as due soon (its own pin window, not a number set here) */
  nextFlagged: boolean;
  change: PriceChange | null;
}

/** Join vendors with what they are owed and their biggest rate change. Sums only; no thresholds. */
export function buildSuppliers(d: VendorsPayload): SupplierRow[] {
  const flagged = new Set(d.recommendations.filter((r) => r.type === "PAYABLE_DUE").map((r) => r.id.slice(r.id.indexOf(":") + 1)));
  const rows = d.vendors.map<SupplierRow>((vendor) => {
    const bills = d.payables.filter((p) => p.vendorId === vendor.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.amountPaise - a.amountPaise);
    const next = bills[0] ?? null;
    return {
      vendor,
      bills,
      outstandingPaise: bills.reduce((s, b) => s + b.amountPaise, 0),
      next,
      nextFlagged: next ? flagged.has(next.purchaseId) : false,
      // the API sorts changes by size, so the first match is the biggest
      change: d.priceChanges.find((c) => c.vendorId === vendor.id) ?? null,
    };
  });
  return rows.sort((a, b) => {
    if (a.next && b.next) return a.next.dueDate.localeCompare(b.next.dueDate) || b.outstandingPaise - a.outstandingPaise;
    if (a.next) return -1;
    if (b.next) return 1;
    return a.vendor.name.localeCompare(b.vendor.name);
  });
}

export function recsFor(d: VendorsPayload, predicate: (r: Recommendation) => boolean): Recommendation[] {
  return d.recommendations.filter(predicate);
}
