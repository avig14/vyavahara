import { getCtx, handle, HttpError, json } from "@/lib/server/http";
import { waConfig } from "@/lib/wa/cloud";
import { sendReportToOwner } from "@/lib/wa/send";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * "Send Report on WhatsApp". The token stays on the server; the browser only learns the outcome.
 * 200 { ok:true, kind:"report"|"template", ... } · 400 no number · 503 not configured · 502 Meta refused { error, kind }.
 */
export const POST = () =>
  handle(async () => {
    const cfg = waConfig();
    if (!cfg) throw new HttpError(503, "WhatsApp set up nahi hai. WHATSAPP_ACCESS_TOKEN aur WHATSAPP_PHONE_NUMBER_ID .env mein daalo.");
    const c = await getCtx();
    const r = await sendReportToOwner(c.db, c.merchantId, cfg, { now: c.now });
    if (r.ok) return json(r);
    return json({ error: r.message, kind: r.reason === "no_number" ? "no_number" : r.errorKind }, r.reason === "no_number" ? 400 : 502);
  });
