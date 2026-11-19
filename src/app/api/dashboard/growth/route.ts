import { getCtx, handle, json } from "@/lib/server/http";
import { loadDash } from "@/lib/server/dash";
import { festivalPlan, upcomingFestivals } from "@/lib/analytics/festival";
import { checkLoan } from "@/lib/analytics/loan";
import { gstSummary } from "@/lib/analytics/gst";

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = () =>
  handle(async () => {
    const d = await loadDash(await getCtx());
    return json({
      festivals: upcomingFestivals(d.snap),
      festivalPlans: festivalPlan(d.snap),
      cashflow: d.cx.cash,
      loan: checkLoan(d.snap),
      gst: gstSummary(d.snap),
      recommendations: d.recs.filter((r) => r.module === "growth"),
    });
  });
