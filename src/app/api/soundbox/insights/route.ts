import { getCtx, handle, json } from "@/lib/server/http";
import { todayInsights } from "@/lib/soundbox/converse";

export const runtime = "nodejs";

/** Today's insight cards for Voice Saathi (high-risk udhaar, stock, payments due, sales, top suggestion). No AI, free. */
export const GET = () =>
  handle(async () => {
    const c = await getCtx();
    return json({ insights: await todayInsights(c.db, c.merchantId, c.now) });
  });
