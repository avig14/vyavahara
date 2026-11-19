/**
 * Sarvam STT + TTS (REST). Verified against docs.sarvam.ai (Nov 2026):
 *  - STT  POST /speech-to-text  multipart {file, model: saaras:v4, mode, language_code}  → {transcript, language_code}
 *  - TTS  POST /text-to-speech  JSON {text, language_code, model: bulbul:v3, speaker}    → {audios: [base64 wav]}
 * Credit discipline: TTS is cached by text; callers should prefer text input in development.
 */
import { createHash } from "node:crypto";

const BASE = "https://api.sarvam.ai";

export class SarvamError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SarvamError";
  }
}

const key = () => {
  const k = process.env.SARVAM_API_KEY;
  if (!k) throw new SarvamError("SARVAM_API_KEY is not set");
  return k;
};

export const sarvamConfigured = () => Boolean(process.env.SARVAM_API_KEY);

export interface Transcript {
  text: string;
  languageCode: string | null;
}

/** Speech → text. `codemix` mode keeps Hinglish as spoken. Clips should be short (REST is for <30 s). */
export async function transcribe(
  audio: Blob | ArrayBuffer | Uint8Array,
  opts: { filename?: string; mime?: string; languageCode?: string } = {},
): Promise<Transcript> {
  const blob =
    audio instanceof Blob
      ? audio
      : new Blob([audio as BlobPart], { type: opts.mime ?? "audio/wav" });
  const form = new FormData();
  form.append("file", blob, opts.filename ?? "audio.wav");
  form.append("model", process.env.SARVAM_STT_MODEL ?? "saaras:v4");
  form.append("mode", "codemix");
  form.append("language_code", opts.languageCode ?? "unknown");

  const res = await fetch(`${BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": key() },
    body: form,
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new SarvamError(`STT failed: ${await errText(res)}`, res.status);
  const j = (await res.json()) as { transcript?: string; language_code?: string | null };
  return { text: (j.transcript ?? "").trim(), languageCode: j.language_code ?? null };
}

const ttsCache = new Map<string, Buffer>();
const TTS_CACHE_MAX = 200;

/** Text → WAV bytes. Cached by (model, speaker, language, text). Max 2500 chars per call (bulbul:v3). */
export async function speak(text: string, opts: { languageCode?: string; speaker?: string } = {}): Promise<Buffer> {
  const clean = text.trim().slice(0, 2500);
  if (!clean) throw new SarvamError("nothing to speak");
  const model = process.env.SARVAM_TTS_MODEL ?? "bulbul:v3";
  const speaker = opts.speaker ?? process.env.SARVAM_TTS_SPEAKER ?? "shubh";
  const lang = opts.languageCode ?? "hi-IN";
  const ck = createHash("sha1").update([model, speaker, lang, clean].join("|")).digest("hex");
  const hit = ttsCache.get(ck);
  if (hit) return hit;

  const res = await fetch(`${BASE}/text-to-speech`, {
    method: "POST",
    headers: { "api-subscription-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({ text: clean, language_code: lang, model, speaker }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new SarvamError(`TTS failed: ${await errText(res)}`, res.status);
  const j = (await res.json()) as { audios?: string[] };
  const b64 = j.audios?.[0];
  if (!b64) throw new SarvamError("TTS returned no audio");
  const buf = Buffer.from(b64, "base64");
  if (ttsCache.size >= TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value as string);
  ttsCache.set(ck, buf);
  return buf;
}

async function errText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    return `${res.status} ${j.error?.message ?? ""}`.trim();
  } catch {
    return String(res.status);
  }
}

/** Soundbox announcement text. Numbers > 4 digits get commas (per Sarvam guidance), amounts in rupees. */
export function paymentAnnouncement(amountPaise: number): string {
  const rupees = Math.floor(amountPaise / 100);
  const paise = amountPaise % 100;
  const r = new Intl.NumberFormat("en-IN").format(rupees);
  return paise ? `${r} rupaye ${paise} paise mile` : `${r} rupaye mile`;
}
