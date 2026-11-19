import type { Heatmap, ReportData } from "@/lib/reports/build";
import type { Recommendation } from "@/lib/analytics/recommendations";

/** `GET /api/dashboard/overview?period=...` */
export interface OverviewPayload {
  merchant: { name: string; ownerName: string };
  report: ReportData;
  recommendations: Recommendation[];
  heatmap: Heatmap;
}

export interface RozmelRow {
  id: string;
  at: string;
  /** signed: refunds are negative */
  amountPaise: number;
  kind: "sale" | "refund";
  method: "upi" | "cash" | "card";
  source: "paytm" | "soundbox" | "manual" | "seed";
  utr: string | null;
  payer: string | null;
  items: { name: string; qty: number; unitPricePaise: number; confidence: "confirmed" | "probable" }[];
  runningTotalPaise: number;
}

/** `GET /api/dashboard/rozmel` */
export interface RozmelPayload {
  day: string;
  count: number;
  totalPaise: number;
  /** oldest first */
  rows: RozmelRow[];
}
