import { getCtx, handle, HttpError, json, readJson } from "@/lib/server/http";
import { resolveChoice } from "@/lib/agent/actions";
import { runAgent } from "@/lib/agent/run";
import { attachmentLinks } from "@/lib/server/artifacts";
import { recentConversation } from "@/lib/db/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Dashboard chat. Same brain as WhatsApp: "1"/"2" answers a waiting confirmation, anything else goes to the agent. */
export const POST = (req: Request) =>
  handle(async () => {
    const body = (await readJson(req)) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) throw new HttpError(400, "text is required");
    if (text.length > 2000) throw new HttpError(400, "text is too long");
    const c = await getCtx();

    const choice = await resolveChoice(c.db, c.merchantId, text, c.now);
    if (choice.handled) return json({ reply: choice.reply, attachments: [] });

    const out = await runAgent(c.db, c.merchantId, text, "web", { now: c.now });
    return json({ reply: out.text, attachments: await attachmentLinks(c.db, c.merchantId, out.attachments) });
  });

/** Chat history for page load. */
export const GET = () =>
  handle(async () => {
    const c = await getCtx();
    const rows = await recentConversation(c.db, c.merchantId, "web", 30);
    return json({ messages: rows.map((r) => ({ role: r.role, content: r.content })) });
  });
