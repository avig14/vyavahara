import { getCtx, handle, json } from "@/lib/server/http";
import { loadDash, parsePeriod } from "@/lib/server/dash";
import { buildReport, salesHeatmap } from "@/lib/reports/build";

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = (req: Request) =>
  handle(async () => {
    const d = await loadDash(await getCtx());
    const { period, custom } = parsePeriod(new URL(req.url));
    return json({
      merchant: { name: d.snap.merchant.name, ownerName: d.snap.merchant.ownerName },
      report: buildReport(d.snap, { period, custom, ctx: d.cx }),
      recommendations: d.recs.slice(0, 8),
      heatmap: salesHeatmap(d.snap),
    });
  });
