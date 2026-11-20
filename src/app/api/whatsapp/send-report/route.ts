import { getCtx, handle, HttpError, json } from "@/lib/server/http";
import { waConfig } from "@/lib/wa/cloud";
import { activeProvider, pickChannel } from "@/lib/wa/channel";
import { sendReportToOwner, sendReportViaChannel } from "@/lib/wa/send";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * "Send Report on WhatsApp" via Twilio (preferred) or Meta. Tokens stay on the server; the browser only learns the outcome.
 * 200 { ok:true, kind:"report"|"template", ... } · 400 no number · 503 not configured · 502 Meta refused { error, kind }.
 */
export const POST = () =>
  handle(async () => {
    const provider = activeProvider();
    if (!provider) throw new HttpError(503, "WhatsApp set up nahi hai. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN aur TWILIO_WHATSAPP_FROM .env mein daalo.");
    const c = await getCtx();
    const ch = pickChannel();
    const cfg = waConfig();
    const r = provider === "twilio" && ch ? await sendReportViaChannel(c.db, ch, c.merchantId, { now: c.now }) : await sendReportToOwner(c.db, c.merchantId, cfg!, { now: c.now });
    if (r.ok) return json(r);
    return json({ error: r.message, kind: r.reason === "no_number" ? "no_number" : r.errorKind }, r.reason === "no_number" ? 400 : 502);
  });
