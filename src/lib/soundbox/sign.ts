/**
 * The speak route only voices text our converse route produced: converse signs (text, language), speak verifies.
 * Stops /api/soundbox/speak from being used as a free text-to-speech proxy on our Sarvam credits.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.SOUNDBOX_SECRET ?? process.env.HASH_SALT;
  if (!s) throw new Error("SOUNDBOX_SECRET (or HASH_SALT) is not set");
  return s;
}

export function signSpoken(text: string, lang: string, key = secret()): string {
  return createHmac("sha256", key).update(`${lang}|${text}`).digest("base64url");
}

export function verifySpoken(text: string, lang: string, sig: string, key = secret()): boolean {
  const want = Buffer.from(signSpoken(text, lang, key));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
