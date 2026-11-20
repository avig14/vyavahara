import { getCtx, handle, HttpError, json, readJson } from "@/lib/server/http";
import { clientIp, hit } from "@/lib/server/rate-limit";
import { loadSnapshot } from "@/lib/db/queries";
import { TWILIO_MAX_TEXT } from "@/lib/wa/channel";
import { splitMessage } from "@/lib/wa/cloud";
import { previewReply } from "@/lib/wa/preview";
import { interactiveFor } from "@/lib/wa/interactive";
import { imagesFor } from "@/lib/wa/media";

export const runtime = "nodejs";
export const maxDuration = 60;

const PER_10_MIN = Number(process.env.PREVIEW_TURNS_PER_10_MIN ?? 120);

/**
 * Chat preview: the owner's message goes through the same menu tree and agent the real bot uses and the reply comes back in
 * the response. Read-only by design: nothing is saved, no provider is called, and the conversation position lives in the
 * browser (`state`), so it never touches the real chat session. Needs no chat credentials.
 * Body { text, state? } → { parts, interactive, images, state }.
 */
export const POST = (req: Request) =>
  handle(async () => {
    const limit = hit(`preview:${clientIp(req)}`, PER_10_MIN, 10 * 60_000);
    if (!limit.ok) throw new HttpError(429, `Preview limit poora ho gaya. ${Math.ceil(limit.retryAfterSec / 60)} min baad try karo.`);
    const c = await getCtx();
    const b = (await readJson(req)) as { text?: unknown; state?: unknown };
    const text = typeof b.text === "string" ? b.text.trim().slice(0, 500) : "";
    if (!text) throw new HttpError(400, "Message khali hai");
    const snap = await loadSnapshot(c.db, c.merchantId, { now: c.now });
    const r = await previewReply(snap, text, b.state as never);
    // long answers arrive as several messages on a real chat, so show them the same way
    return json({ parts: r.parts.flatMap((p) => splitMessage(p, TWILIO_MAX_TEXT)), interactive: interactiveFor(r.shown), images: imagesFor(r.shown), state: r.state });
  });
