import { getCtx, handle, HttpError, json } from "@/lib/server/http";
import { waConfig } from "@/lib/wa/cloud";
import { activeProvider, pickChannel } from "@/lib/wa/channel";
import { sendReportToOwner, sendReportViaChannel } from "@/lib/wa/send";
import { REPORT_KINDS, REPORT_PERIODS } from "@/lib/wa/reports";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * "Send Report on WhatsApp" via Twilio (preferred) or Meta. Tokens stay on the server; the browser only learns the outcome.
 * Optional body { kind: daily|sales|customers|vendors|recommendations, period: today|this_week|this_month }.
 * 200 { ok:true, kind:"report"|"template", ... } · 400 no number · 503 not configured · 502 Meta refused { error, kind }.
 */
export const POST = (req: Request) =>
  handle(async () => {
    const provider = activeProvider();
    if (!provider) throw new HttpError(503, "WhatsApp set up nahi hai. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN aur TWILIO_WHATSAPP_FROM .env mein daalo.");
    const body = (await req.json().catch(() => ({}))) as { kind?: unknown; period?: unknown };
    const kind = REPORT_KINDS.find((k) => k === body.kind);
    const period = REPORT_PERIODS.find((p) => p === body.period);
    if (body.kind !== undefined && !kind) throw new HttpError(400, "Unknown report type");
    const c = await getCtx();
    const ch = pickChannel();
    const cfg = waConfig();
    const r =
      provider === "twilio" && ch
        ? await sendReportViaChannel(c.db, ch, c.merchantId, { now: c.now, kind, period })
        : await sendReportToOwner(c.db, c.merchantId, cfg!, { now: c.now, kind, period });
    if (r.ok) return json(r);
    return json({ error: r.message, kind: r.reason === "no_number" ? "no_number" : r.errorKind }, r.reason === "no_number" ? 400 : 502);
  });
