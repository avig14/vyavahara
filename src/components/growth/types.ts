import type { CashFlow } from "@/lib/analytics/cashflow";
import type { FestivalPlan, UpcomingFestival } from "@/lib/analytics/festival";
import type { GstSummary } from "@/lib/analytics/gst";
import type { LoanCheck } from "@/lib/analytics/loan";
import type { Recommendation } from "@/lib/analytics/recommendations";

/** Body of GET /api/dashboard/growth. JSON turns an Infinity into null, so the loan cv can arrive as null. */
export interface GrowthResponse {
  festivals: UpcomingFestival[];
  festivalPlans: FestivalPlan[];
  cashflow: CashFlow;
  loan: Omit<LoanCheck, "cv"> & { cv: number | null };
  gst: GstSummary;
  recommendations: Recommendation[];
}
