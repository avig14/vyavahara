import { getDb } from "@/lib/db/client";
import { getAttempt, updateAttempt } from "@/lib/calls/store";
import { readParams, webhookAuthorized } from "@/lib/calls/webhook";

export const runtime = "nodejs";
export const maxDuration = 10;

/** Call ended. If nobody pressed a key and the line never connected, record "no_answer". */
export async function POST(req: Request) {
  if (!webhookAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const id = new URL(req.url).searchParams.get("attempt") ?? "";
  const params = await readParams(req);
  const db = getDb();
  const a = id ? await getAttempt(db, id) : null;
  if (a) {
    const reason = params.HangupCause ?? params.CallStatus ?? "";
    await updateAttempt(db, id, { status: "completed", outcome: a.outcome ?? "no_answer", detail: reason.slice(0, 200) || undefined, durationSec: Number.isFinite(Number(params.Duration)) && params.Duration ? Math.round(Number(params.Duration)) : undefined });
  }
  return new Response(null, { status: 200 });
}
