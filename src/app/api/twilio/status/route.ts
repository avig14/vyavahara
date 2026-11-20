import { getDb } from "@/lib/db/client";
import { applyWaStatus } from "@/lib/db/queries";
import { parseStatus, publicWebhookUrl, readForm, twilioConfig, verifyTwilioSignature } from "@/lib/wa/twilio";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Delivery receipts (sent / delivered / read / failed) for messages we sent. Same signature rule as the inbound webhook. */
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

  const s = parseStatus(params);
  if (s) {
    try {
      await applyWaStatus(getDb(), s.id, s.status, s.code, s.detail);
    } catch (e) {
      console.error("[twilio/status]", e instanceof Error ? e.message : "unknown");
    }
  }
  return new Response(null, { status: 200 });
}
