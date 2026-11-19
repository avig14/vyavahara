import { getCtx, handle, json, readJson } from "@/lib/server/http";
import { isPeriodName } from "@/lib/time";
import { mintReportLink } from "@/lib/server/artifacts";

export const runtime = "nodejs";
export const maxDuration = 30;

/** `{ period, from?, to? }` → a 7-day link to the PDF. */
export const POST = (req: Request) =>
  handle(async () => {
    const b = (await readJson(req)) as { period?: unknown; from?: unknown; to?: unknown };
    const period = typeof b.period === "string" && isPeriodName(b.period) ? b.period : "today";
    let custom: { from: Date; to: Date } | undefined;
    if (period === "custom") {
      const from = new Date(String(b.from));
      const to = new Date(String(b.to));
      if (isNaN(+from) || isNaN(+to) || to <= from) return json({ error: "custom needs valid from < to" }, 400);
      custom = { from, to };
    }
    const c = await getCtx();
    return json({ url: await mintReportLink(c.db, c.merchantId, { period, custom }) });
  });
