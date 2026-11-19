import type { ItemForecast, StockStatus } from "@/lib/analytics/forecast";
import type { Recommendation } from "@/lib/analytics/recommendations";
import type { LostDemand } from "@/lib/domain";

export type { ItemForecast, StockStatus, Recommendation };

/** `lostDemand.rows` as it arrives over JSON (dates are ISO strings). */
export type LostRow = Omit<LostDemand, "createdAt"> & { createdAt: string };

/** `GET /api/dashboard/inventory` */
export interface InventoryPayload {
  forecasts: ItemForecast[];
  counts: Partial<Record<StockStatus, number>>;
  lostDemand: { totalPaise: number; rows: LostRow[] };
  recommendations: Recommendation[];
}
