import { getCtx, handle, json } from "@/lib/server/http";
import { loadDash, parsePeriod } from "@/lib/server/dash";
import { buildReport } from "@/lib/reports/build";
import { reportText } from "@/lib/reports/text";

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = (req: Request) =>
  handle(async () => {
    const d = await loadDash(await getCtx());
    const { period, custom } = parsePeriod(new URL(req.url));
    const report = buildReport(d.snap, { period, custom, ctx: d.cx });
    return json({ report, text: reportText(report) });
  });
