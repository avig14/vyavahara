import { getCtx, handle, HttpError, json, readJson } from "@/lib/server/http";
import { clientIp, hit } from "@/lib/server/rate-limit";
import { paid } from "@/lib/soundbox/flow";
import { paymentAnnouncement, sarvamConfigured, speak } from "@/lib/ingest/sarvam";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * A UPI payment arrived at the soundbox: `{ "amountPaise": 12800, "speak": false }`.
 * Matches it to the basket heard in the last few minutes (settings.ingest) and saves an item-level sale.
 * Set `speak: true` to also get the announcement as base64 WAV (costs Sarvam credits, so off by default).
 */
export const POST = (req: Request) =>
  handle(async () => {
    if (!hit(`sb-pay:${clientIp(req)}`, Number(process.env.SOUNDBOX_TURNS_PER_10_MIN ?? 30), 10 * 60_000).ok) throw new HttpError(429, "Demo limit reached");
    const body = (await readJson(req)) as { amountPaise?: unknown; speak?: unknown };
    const amountPaise = body.amountPaise;
    if (typeof amountPaise !== "number" || !Number.isInteger(amountPaise) || amountPaise <= 0 || amountPaise > 10_000_000_00) throw new HttpError(400, "amountPaise must be a positive integer (paise)");

    const c = await getCtx();
    const r = await paid(c.db, c.merchantId, amountPaise, c.now);
    const announcement = paymentAnnouncement(amountPaise);

    let audioBase64: string | undefined;
    if (body.speak === true && sarvamConfigured()) {
      try {
        audioBase64 = (await speak(announcement)).toString("base64");
      } catch {
        /* the sale is saved; a missing voice is not an error */
      }
    }
    return json({ transactionId: r.transactionId, announcement, matchedBasket: r.matchedBasket, confidence: r.confidence, items: r.summary, audioBase64 });
  });
