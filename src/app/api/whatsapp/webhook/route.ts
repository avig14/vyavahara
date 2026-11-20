import { after } from "next/server";
import { flushWrites, getDb } from "@/lib/db/client";
import { applyWaStatus } from "@/lib/db/queries";
import { parseWebhook, verifySignature, waConfig } from "@/lib/wa/cloud";
import { metaChannel } from "@/lib/wa/channel";
import { handleInbound } from "@/lib/wa/router";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Meta's one-time handshake: echo hub.challenge when the verify token matches ours. */
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const want = process.env.WHATSAPP_VERIFY_TOKEN;
  if (want && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === want) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Delivery statuses and inbound messages. Must answer 200 fast, so statuses are saved inline and replies run in after().
 * The body is only trusted when its signature matches the App Secret.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (secret && !verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) return new Response("Bad signature", { status: 401 });
  if (!secret && process.env.NODE_ENV === "production") return new Response("WHATSAPP_APP_SECRET is not set", { status: 503 });
  if (!process.env.DATABASE_URL) return new Response("DATABASE_URL is not set", { status: 503 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const { messages, statuses } = parseWebhook(body);
  const db = getDb();
  try {
    for (const s of statuses) await applyWaStatus(db, s.id, s.status, s.code, s.detail);
  } catch (e) {
    console.error("[wa/webhook] status", e instanceof Error ? e.message : "unknown");
  }

  const cfg = waConfig();
  if (messages.length && cfg) {
    const ch = metaChannel(cfg);
    after(async () => {
      try {
        for (const m of messages) await handleInbound(db, ch, { id: m.id, from: m.from, text: m.text ?? m.reply ?? null, media: null });
      } finally {
        await flushWrites();
      }
    });
  }
  return new Response("ok", { status: 200 });
}
