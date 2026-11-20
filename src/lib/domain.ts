import type { MerchantSettings } from "./settings";
/**
 * Plain-data domain types. The seed generator and the DB loader both produce a `Snapshot`;
 * every analytics function is a pure function of a Snapshot (+ `now`). No DB, no I/O.
 * Money = integer paise. Timestamps = Date. 'YYYY-MM-DD' strings = IST calendar days.
 */

export interface Merchant {
  id: string;
  name: string;
  ownerName: string;
  ownerPhoneWa: string | null;
  waConnectedAt: Date | null;
  waLastInboundAt: Date | null;
  upiId: string | null;
  gstScheme: "composition" | "regular" | "none";
  city: string | null;
}

export type ProductCategory =
  | "staples"
  | "dairy"
  | "snacks"
  | "beverages"
  | "personal"
  | "household"
  | "sweets"
  | "dry_fruits"
  | "bakery";

export interface Product {
  id: string;
  sku: string;
  name: string;
  aliases: string[];
  category: ProductCategory | string;
  unit: string;
  packSize: number;
  pricePaise: number;
  costPaise: number;
  gstRate: number;
  stockQty: number;
  isActive: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  leadTimeDays: number;
  paymentTermsDays: number;
}

export interface VendorProduct {
  vendorId: string;
  productId: string;
  lastCostPaise: number;
  prevCostPaise: number | null;
  updatedAt: Date;
}

export interface Purchase {
  id: string;
  vendorId: string;
  invoiceNo: string | null;
  invoiceDate: string;
  totalPaise: number;
  dueDate: string;
  status: "unpaid" | "partial" | "paid";
  source: "photo" | "manual" | "seed";
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  qty: number;
  unitCostPaise: number;
  gstRate: number;
}

export interface VendorPayment {
  id: string;
  vendorId: string;
  amountPaise: number;
  createdAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  vpaHash: string | null;
  creditLimitPaise: number;
  creditBlocked: boolean;
  createdAt: Date;
}

export interface Txn {
  id: string;
  customerId: string | null;
  amountPaise: number;
  method: "upi" | "cash" | "card";
  kind: "sale" | "refund";
  utr: string | null;
  /** only the seed fills this; loadSnapshot leaves it out to save transfer */
  payerVpaHash?: string | null;
  source: "paytm" | "soundbox" | "manual" | "seed";
  createdAt: Date;
}

export interface SaleItem {
  /** only the seed fills this; loadSnapshot leaves it out to save transfer */
  id?: string;
  transactionId: string;
  productId: string;
  qty: number;
  unitPricePaise: number;
  unitCostPaise: number;
  confidence: "confirmed" | "probable";
  createdAt: Date;
}

export interface KhataEntry {
  id: string;
  customerId: string;
  type: "credit" | "payment";
  amountPaise: number;
  note: string | null;
  source: string | null;
  createdAt: Date;
}

export interface Expense {
  id: string;
  category: "rent" | "electricity" | "salary" | "transport" | "other";
  amountPaise: number;
  note: string | null;
  createdAt: Date;
}

export interface LostDemand {
  id: string;
  productId: string;
  rawText: string | null;
  qty: number;
  estValuePaise: number;
  createdAt: Date;
}

export interface Festival {
  id: string;
  name: string;
  /** 'YYYY-MM-DD' */
  date: string;
  categories: string[];
}

export interface Snapshot {
  now: Date;
  merchant: Merchant;
  /** merchant-tunable thresholds (src/lib/settings.ts) */
  settings: MerchantSettings;
  products: Product[];
  vendors: Vendor[];
  vendorProducts: VendorProduct[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  vendorPayments: VendorPayment[];
  customers: Customer[];
  transactions: Txn[];
  saleItems: SaleItem[];
  khata: KhataEntry[];
  expenses: Expense[];
  lostDemand: LostDemand[];
  festivals: Festival[];
}

/** Small shared helpers used by analytics. */
export function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: number[]): number {
  return xs.length ? sum(xs) / xs.length : 0;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}
