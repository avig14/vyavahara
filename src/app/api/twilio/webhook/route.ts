import { after } from "next/server";
import { flushWrites, getDb } from "@/lib/db/client";
import { pickChannel } from "@/lib/wa/channel";
import { handleInbound } from "@/lib/wa/router";
import { parseInbound, publicWebhookUrl, readForm, twilioConfig, verifyTwilioSignature } from "@/lib/wa/twilio";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Twilio posts every WhatsApp message the owner sends here (form-encoded, signed with X-Twilio-Signature).
 * We answer an empty 200 right away (the sandbox rejects TwiML on trial) and reply through the REST API in after().
 */
export async function POST(req: Request) {
  const cfg = twilioConfig();
  if (!cfg) return new Response("Twilio is not configured", { status: 503 });
  if (!process.env.DATABASE_URL) return new Response("DATABASE_URL is not set", { status: 503 });

  let params;
  try {
    params = await readForm(req);
  } catch {
    return new Response("Bad form", { status: 400 });
  }
  if (!verifyTwilioSignature(cfg.authToken, req.headers.get("x-twilio-signature"), publicWebhookUrl(req), params)) return new Response("Bad signature", { status: 401 });

  const inbound = parseInbound(params);
  const ch = pickChannel();
  if (inbound && ch) {
    const db = getDb();
    after(async () => {
      try {
        await handleInbound(db, ch, inbound);
      } finally {
        await flushWrites();
      }
    });
  }
  return new Response(null, { status: 200 });
}
