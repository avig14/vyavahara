/**
 * Proactive red-khata alert (PRD A7/A9). A customer turns red → tell the owner once, with three clear choices.
 * Rules, all from the merchant's settings (settings.alerts), none hard-coded:
 *  - khataRed off → nothing
 *  - one alert per customer per cooldownDays
 *  - sent straight away only if the 24h WhatsApp window is open AND the hour is inside [sendFromHour, sendUntilHour) IST
 *  - otherwise queued, and shown (with "📌 N naya khata alert") on the owner's next message
 */
import type { Db } from "../db/client";
import {
  createAlert,
  dismissQueuedFor,
  queuedAlerts,
  recentAlertFor,
  setAlertStatus,
  setWaSession,
  type KhataAlertPayload,
} from "../db/queries";
import type { Snapshot } from "../domain";
import { rupees } from "../format";
import { MS_DAY, istHour } from "../time";
import { khataOverview } from "../analytics/khata-risk";
import type { Awaiting } from "../menu/menus";
import { deliver, type Channel } from "./channel";

const WINDOW_MS = MS_DAY;

/** The message from PRD A7. Numbers come from code; the wording is fixed. */
export function alertText(p: KhataAlertPayload): string {
  const lines = [`🔴 *Khata alert:* ${p.name} / ${rupees(p.outstandingPaise)} baaki — ${p.oldestUnpaidDays} din se.`];
  lines.push(`Pichle 90 din mein sirf ${p.repaid90Pct}% chukaya.`);
  if (p.reasons.length) lines.push(...p.reasons.slice(0, 2).map((r) => `• ${r}`));
  lines.push("", p.creditBlocked ? "_Iska udhaar pehle se band hai._" : `Suggestion: ${p.name} ko naya udhaar band karein.`, "", "*1* = Udhaar band karo", "*2* = Reminder message banao", "*3* = Ignore");
  return lines.join("\n");
}

export interface RedCandidate {
  customerId: string;
  payload: KhataAlertPayload;
}

/** Red customers with money outstanding, worst first. Pure. */
export function redCandidates(snap: Snapshot): RedCandidate[] {
  return khataOverview(snap)
    .accounts.filter((a) => a.band === "red" && a.outstandingPaise > 0)
    .map((a) => ({
      customerId: a.customerId,
      payload: {
        name: a.name,
        outstandingPaise: a.outstandingPaise,
        oldestUnpaidDays: a.oldestUnpaidDays,
        repaid90Pct: Math.round(a.repayRatio90 * 100),
        reasons: a.reasons,
        creditBlocked: a.creditBlocked,
      },
    }));
}

export const awaitingAlert = (customerId: string, name: string): Awaiting => ({ kind: "alert", customerId, name });

export function windowOpen(lastInbound: Date | null, now: Date): boolean {
  return !!lastInbound && now.getTime() - lastInbound.getTime() < WINDOW_MS;
}

export function inSendHours(now: Date, from: number, until: number): boolean {
  const h = istHour(now);
  return h >= from && h < until;
}

export interface AlertRun {
  created: number;
  sentNow: number;
  queued: number;
}

/**
 * Look for newly red customers and alert the owner. Safe to call often (khata write, dashboard load):
 * the cool-down makes it idempotent. `ch` null = cannot send, so everything queues for the next message.
 */
export async function checkKhataAlerts(db: Db, merchantId: string, snap: Snapshot, ch: Channel | null, now = new Date()): Promise<AlertRun> {
  const out: AlertRun = { created: 0, sentNow: 0, queued: 0 };
  const cfg = snap.settings.alerts;
  if (!cfg.khataRed) return out;

  const red = redCandidates(snap);
  // a queued alert is moot once the customer is no longer red
  const stillRed = new Set(red.map((r) => r.customerId));
  await dismissQueuedFor(db, merchantId, snap.customers.map((c) => c.id).filter((id) => !stillRed.has(id)));

  const m = snap.merchant;
  const canSendNow = !!ch && !!m.ownerPhoneWa && !!m.waConnectedAt && windowOpen(m.waLastInboundAt, now) && inSendHours(now, cfg.sendFromHour, cfg.sendUntilHour);
  const since = new Date(now.getTime() - cfg.cooldownDays * MS_DAY);
  let sentOne = false; // one live message per check; the owner answers one at a time

  for (const r of red) {
    if (await recentAlertFor(db, merchantId, r.customerId, since)) continue;
    out.created++;
    if (canSendNow && !sentOne) {
      const res = await deliver(db, ch!, merchantId, m.ownerPhoneWa!, [{ text: alertText(r.payload) }], "alert", now);
      if (res.sent > 0) {
        await createAlert(db, merchantId, r.customerId, r.payload, "sent", now);
        await setWaSession(db, merchantId, { menuPath: "", context: awaitingAlert(r.customerId, r.payload.name) }, now);
        sentOne = true;
        out.sentNow++;
        continue;
      }
    }
    await createAlert(db, merchantId, r.customerId, r.payload, "queued", now);
    out.queued++;
  }
  return out;
}

/**
 * The owner just wrote: hand over alerts that waited. Returns the text to put before the reply
 * (null if none) and the customer the 1/2/3 answer is about.
 */
export async function takeQueuedAlerts(db: Db, merchantId: string, now = new Date()): Promise<{ text: string; awaiting: Awaiting } | null> {
  const rows = await queuedAlerts(db, merchantId);
  if (!rows.length) return null;
  const first = rows[0];
  const p = first.payload as KhataAlertPayload;
  await setAlertStatus(db, rows.map((r) => r.id), "delivered_on_next", now);
  const head = rows.length > 1 ? `📌 ${rows.length} naye khata alert (sabse zaroori pehle):\n\n` : "📌 1 naya khata alert:\n\n";
  return { text: head + alertText(p), awaiting: awaitingAlert(first.subjectId, p.name) };
}
