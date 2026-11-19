import { getCtx, handle, json } from "@/lib/server/http";
import { loadDash } from "@/lib/server/dash";
import { sum } from "@/lib/domain";

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = () =>
  handle(async () => {
    const d = await loadDash(await getCtx());
    const counts: Record<string, number> = {};
    for (const f of d.cx.forecasts) counts[f.status] = (counts[f.status] ?? 0) + 1;
    return json({
      forecasts: d.cx.forecasts,
      counts,
      lostDemand: {
        totalPaise: sum(d.snap.lostDemand.map((l) => l.estValuePaise)),
        rows: d.snap.lostDemand.slice(-50),
      },
      recommendations: d.recs.filter((r) => r.module === "inventory"),
    });
  });
