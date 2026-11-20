import { getCtx, handle, HttpError, json, readJson } from "@/lib/server/http";
import { answerFor } from "@/lib/wa/router";
import { splitMessage } from "@/lib/wa/cloud";
import { interactiveFor } from "@/lib/wa/interactive";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * WhatsApp preview: the owner's message goes through the same router the real bot uses (menu, reports, the agent)
 * and the reply comes back in the response. Nothing is sent to Meta, so it needs no WhatsApp credentials.
 */
export const POST = (req: Request) =>
  handle(async () => {
    const c = await getCtx();
    const b = (await readJson(req)) as { text?: unknown };
    const text = typeof b.text === "string" ? b.text.trim().slice(0, 500) : "";
    if (!text) throw new HttpError(400, "Message khali hai");
    const reply = await answerFor(c.db, c.merchantId, text, null, c.now, { preview: true });
    // long answers arrive as several messages on WhatsApp, so show them the same way
    return json({ parts: splitMessage(reply), interactive: interactiveFor(text) });
  });
