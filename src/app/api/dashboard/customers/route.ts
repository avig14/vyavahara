import { getCtx, handle, json } from "@/lib/server/http";
import { loadDash } from "@/lib/server/dash";
import { segmentCustomers } from "@/lib/analytics/segments";

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = () =>
  handle(async () => {
    const d = await loadDash(await getCtx());
    return json(segmentCustomers(d.snap));
  });
