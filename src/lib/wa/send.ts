/**
 * Send the analysis to the owner and keep a delivery record the dashboard can show.
 * Order matters: the row is written as "sending" first, so a crash mid-send never leaves a message with no trace.
 */
import type { Db } from "../db/client";
import { getWaState, loadSnapshot, markWaFailed, markWaSent, startWaMessage } from "../db/queries";
import { maskPhone, sendLongText, sendTemplate, WaError, type WaConfig } from "./cloud";
import { whatsappDigest } from "./digest";

/** WhatsApp only allows free text within 24 hours of the owner's last message to us. */
export const WINDOW_MS = 24 * 3_600_000;

export const windowOpenUntil = (lastInboundAt: Date | null, now: Date): Date | null => {
  if (!lastInboundAt) return null;
  const end = new Date(lastInboundAt.getTime() + WINDOW_MS);
  return end > now ? end : null;
};

export type SendOutcome =
  | { ok: true; kind: "report"; to: string; parts: number; messageId: string }
  | { ok: true; kind: "template"; to: string; messageId: string; notice: string }
  | { ok: false; reason: "no_number" | "wa_error"; errorKind?: WaError["kind"]; message: string; to?: string; messageId?: string };

export async function sendReportToOwner(db: Db, merchantId: string, cfg: WaConfig, opts: { now?: Date; fetch?: typeof fetch } = {}): Promise<SendOutcome> {
  const now = opts.now ?? new Date();
  const f = opts.fetch ?? fetch;
  const state = await getWaState(db, merchantId);
  if (!state.phone) return { ok: false, reason: "no_number", message: "Pehle WhatsApp number daalo." };
  const to = state.phone;
  const shown = maskPhone(to);

  const snap = await loadSnapshot(db, merchantId, { now });
  const text = whatsappDigest(snap).text;
  const id = await startWaMessage(db, merchantId, "report", text.split("\n")[0]);
  try {
    const r = await sendLongText(to, text, cfg, f);
    await markWaSent(db, id, r.wamid);
    return { ok: true, kind: "report", to: shown, parts: r.parts, messageId: id };
  } catch (e) {
    if (!(e instanceof WaError)) {
      await markWaFailed(db, id, null, "Unexpected error");
      throw e;
    }
    if (e.kind !== "window") {
      await markWaFailed(db, id, e.code, e.message);
      return { ok: false, reason: "wa_error", errorKind: e.kind, message: e.message, to: shown, messageId: id };
    }
    // Outside the 24h window only an approved template may be sent. hello_world opens the chat so the owner can reply "Hi".
    await markWaFailed(db, id, e.code, e.message);
    const tid = await startWaMessage(db, merchantId, "template", "hello_world (chat kholne ke liye)");
    try {
      const t = await sendTemplate(to, cfg, "hello_world", "en_US", f);
      await markWaSent(db, tid, t.wamid);
      return {
        ok: true,
        kind: "template",
        to: shown,
        messageId: tid,
        notice: "Report abhi nahi ja sakta: 24 ghante ki window band hai. Phone par 'Hi' reply karo, phir Send dobara dabao.",
      };
    } catch (e2) {
      const err = e2 instanceof WaError ? e2 : null;
      await markWaFailed(db, tid, err?.code ?? null, err?.message ?? "Unexpected error");
      if (!err) throw e2;
      return { ok: false, reason: "wa_error", errorKind: err.kind, message: err.message, to: shown, messageId: tid };
    }
  }
}
