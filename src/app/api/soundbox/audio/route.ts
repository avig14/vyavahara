import { getCtx, handle, HttpError, json } from "@/lib/server/http";
import { clientIp, hit } from "@/lib/server/rate-limit";
import { heard } from "@/lib/soundbox/flow";
import { parseSoundbox } from "@/lib/ingest/vision";
import { sarvamConfigured, SarvamError, transcribe } from "@/lib/ingest/sarvam";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

/**
 * Customer speech at the counter. Either multipart `file` (short WAV clip) or JSON `{ "text": "..." }`
 * (text skips Sarvam STT: cheap for demos and tests). The audio itself is never stored.
 */
export const POST = (req: Request) =>
  handle(async () => {
    if (!hit(`sb-audio:${clientIp(req)}`, Number(process.env.SOUNDBOX_TURNS_PER_10_MIN ?? 30), 10 * 60_000).ok) throw new HttpError(429, "Demo limit reached");
    let text = "";
    let languageCode: string | null = null;
    const type = req.headers.get("content-type") ?? "";

    if (type.includes("multipart/form-data")) {
      const file = (await req.formData()).get("file");
      if (!(file instanceof Blob)) throw new HttpError(400, "file is required");
      if (file.size === 0 || file.size > MAX_AUDIO_BYTES) throw new HttpError(400, "audio must be 1 byte to 5 MB");
      if (!sarvamConfigured()) throw new HttpError(503, "SARVAM_API_KEY is not set");
      try {
        const t = await transcribe(file);
        text = t.text;
        languageCode = t.languageCode;
      } catch (e) {
        if (e instanceof SarvamError) throw new HttpError(502, "Speech service failed");
        throw e;
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as { text?: unknown };
      text = typeof body.text === "string" ? body.text.trim().slice(0, 500) : "";
    }
    if (!text) throw new HttpError(400, "No speech heard");

    const c = await getCtx();
    const parsed = await parseSoundbox(text);
    const result = await heard(c.db, c.merchantId, text, parsed, c.now);
    return json({ transcript: text, languageCode, ...result });
  });
