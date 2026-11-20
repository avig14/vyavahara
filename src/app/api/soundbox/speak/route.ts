import { handle, HttpError, readJson } from "@/lib/server/http";
import { clientIp, hit } from "@/lib/server/rate-limit";
import { sarvamConfigured, SarvamError, speak } from "@/lib/ingest/sarvam";
import { verifySpoken } from "@/lib/soundbox/sign";

export const runtime = "nodejs";
export const maxDuration = 60;

const PER_10_MIN = Number(process.env.SOUNDBOX_TURNS_PER_10_MIN ?? 60) * 2;

/**
 * Text → Soundbox voice (Sarvam text-to-speech, cached by text). Only speaks text signed by /api/soundbox/converse
 * or /api/soundbox/payment, so it cannot be used as an open TTS service. Returns audio/wav.
 */
export const POST = (req: Request) =>
  handle(async () => {
    const limit = hit(`speak:${clientIp(req)}`, PER_10_MIN, 10 * 60_000);
    if (!limit.ok) throw new HttpError(429, "Demo limit reached");
    const body = (await readJson(req)) as { text?: unknown; lang?: unknown; sig?: unknown };
    const text = typeof body.text === "string" ? body.text : "";
    const lang = body.lang === "en-IN" ? "en-IN" : "hi-IN";
    const sig = typeof body.sig === "string" ? body.sig : "";
    if (!text || text.length > 600) throw new HttpError(400, "text is required (max 600 chars)");
    if (!verifySpoken(text, lang, sig)) throw new HttpError(403, "Unsigned text");
    if (!sarvamConfigured()) throw new HttpError(503, "SARVAM_API_KEY is not set");
    try {
      const wav = await speak(text, { languageCode: lang });
      return new Response(new Uint8Array(wav), { headers: { "content-type": "audio/wav", "cache-control": "private, max-age=3600" } });
    } catch (e) {
      if (e instanceof SarvamError) throw new HttpError(502, "Voice service failed");
      throw e;
    }
  });
