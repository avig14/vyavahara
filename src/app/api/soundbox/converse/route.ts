import { getCtx, handle, HttpError, json } from "@/lib/server/http";
import { clientIp, hit } from "@/lib/server/rate-limit";
import { sarvamConfigured, SarvamError, transcribe } from "@/lib/ingest/sarvam";
import { greetTurn, voiceTurn } from "@/lib/soundbox/converse";
import { replyLanguage } from "@/lib/soundbox/voice";
import { signSpoken } from "@/lib/soundbox/sign";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 300;
const PER_10_MIN = Number(process.env.SOUNDBOX_TURNS_PER_10_MIN ?? 60);

/**
 * Soundbox voice mode, one turn: the owner speaks (multipart `file`, a short WAV) or taps a suggestion (JSON `{text}`).
 * Speech → text (Sarvam) → yes/no, deterministic answer, or the agent → short spoken reply.
 * Returns text only; the voice comes from POST /api/soundbox/speak with the signed text, so the reply shows first.
 * Optional `variant: "landing"` + env SOUNDBOX_LANDING_READONLY=true: nothing is saved from the public page.
 * The audio itself is never stored.
 */
export const POST = (req: Request) =>
  handle(async () => {
    const limit = hit(`converse:${clientIp(req)}`, PER_10_MIN, 10 * 60_000);
    if (!limit.ok) throw new HttpError(429, `Demo limit reached. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.`);

    let text = "";
    let sttLanguage: string | null = null;
    let variant: string | null = null;
    const t0 = Date.now();
    let sttMs: number | null = null;
    const type = req.headers.get("content-type") ?? "";

    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      variant = typeof form.get("variant") === "string" ? (form.get("variant") as string) : null;
      if (!(file instanceof Blob)) throw new HttpError(400, "file is required");
      if (file.size === 0 || file.size > MAX_AUDIO_BYTES) throw new HttpError(400, "audio must be 1 byte to 2 MB");
      if (!sarvamConfigured()) throw new HttpError(503, "SARVAM_API_KEY is not set");
      try {
        const t = await transcribe(file);
        text = t.text;
        sttLanguage = t.languageCode;
      } catch (e) {
        if (e instanceof SarvamError) throw new HttpError(502, "Speech service failed");
        throw e;
      }
      sttMs = Date.now() - t0;
      if (!text) return json({ status: "no_speech", sttMs });
    } else {
      const body = (await req.json().catch(() => ({}))) as { text?: unknown; variant?: unknown; greet?: unknown };
      if (body.greet === true) {
        const c = await getCtx();
        const turn = await greetTurn(c.db, c.merchantId, c.now);
        return json({ status: "ok", transcript: "", language: null, sttMs: null, ...turn, lang: "hi-IN", sig: signSpoken(turn.spokenText, "hi-IN"), voice: sarvamConfigured() });
      }
      text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
      variant = typeof body.variant === "string" ? body.variant : null;
      if (!text) throw new HttpError(400, "text is required");
      if (/[ऀ-ॿ]/.test(text)) sttLanguage = "hi-IN";
    }

    const c = await getCtx();
    const readonly = variant === "landing" && process.env.SOUNDBOX_LANDING_READONLY === "true";
    const turn = await voiceTurn(c.db, c.merchantId, text, { now: c.now, readonly });
    const lang = replyLanguage(sttLanguage);
    return json({
      status: "ok",
      transcript: text,
      language: sttLanguage,
      sttMs,
      ...turn,
      lang,
      sig: signSpoken(turn.spokenText, lang),
      voice: sarvamConfigured(),
    });
  });
