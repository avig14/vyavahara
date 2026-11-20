import type { Recommendation } from "@/lib/analytics/recommendations";

export type { Recommendation };

export interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  leadTimeDays: number;
  paymentTermsDays: number;
}

export interface Payable {
  purchaseId: string;
  vendorId: string;
  vendorName: string;
  invoiceNo: string | null;
  /** YYYY-MM-DD */
  dueDate: string;
  /** negative means overdue */
  dueInDays: number;
  amountPaise: number;
  status: "unpaid" | "partial";
}

export interface PriceChange {
  vendorId: string;
  productId: string;
  lastCostPaise: number;
  prevCostPaise: number;
  updatedAt: string;
  changePct: number;
}

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  items: { productId: string; name: string; qty: number; unit: string }[];
  status: "drafted" | "sent" | "received";
  createdAt: string;
}

/** `GET /api/dashboard/vendors` */
export interface VendorsPayload {
  vendors: Vendor[];
  payables: Payable[];
  /** which supplier sells which product, at the last bill rate */
  vendorProducts: {
    vendorId: string;
    productId: string;
    lastCostPaise: number;
  }[];
  priceChanges: PriceChange[];
  purchaseOrders: PurchaseOrder[];
  recommendations: Recommendation[];
}

export interface StockNames {
  forecasts: { productId: string; name: string }[];
}
