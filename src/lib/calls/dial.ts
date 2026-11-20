/** Place one reminder call: create the attempt row, ask Vobiz to dial, record the result. Shared by the batch run and Voice Saathi. */
import type { Db } from "../db/client";
import { loadSnapshot } from "../db/queries";
import { khataOverview } from "../analytics/khata-risk";
import { rupees } from "../format";
import { inCallingHours } from "./select";
import { createAttempt, updateAttempt } from "./store";
import { normalizeIndianPhone, placeCall, vobizConfig, type VobizConfig } from "./vobiz";
import { publicBase } from "./webhook";

export interface DialTarget {
  customerId: string;
  phone: string;
  amountPaise: number;
  overdueDays: number;
}

export type DialResult = { ok: true; attemptId: string } | { ok: false; error: string };

/** Webhooks must be reachable by Vobiz, so the base URL has to be public https. */
export function webhookBase(env: Record<string, string | undefined> = process.env): string | null {
  const b = publicBase(env);
  return /^https:\/\//.test(b) && !/localhost|127\.0\.0\.1/.test(b) ? b : null;
}

/**
 * Demo guard: CALLS_ALLOWED_NUMBERS="919179772540,..." means Call Saathi dials only those numbers, whoever presses the button.
 * Unset = no restriction (production with real, consenting customers).
 */
export function numberAllowed(phone: string, env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.CALLS_ALLOWED_NUMBERS?.trim();
  if (!raw) return true;
  const list = raw.split(",").map((x) => normalizeIndianPhone(x)).filter(Boolean);
  return list.includes(phone);
}

export async function dialTarget(db: Db, cfg: VobizConfig, base: string, secret: string, merchantId: string, t: DialTarget): Promise<DialResult> {
  if (!numberAllowed(t.phone)) return { ok: false, error: "number not on the demo allowlist" };
  const attemptId = await createAttempt(db, { merchantId, customerId: t.customerId, amountPaise: t.amountPaise, overdueDays: t.overdueDays });
  const q = `attempt=${encodeURIComponent(attemptId)}&k=${encodeURIComponent(secret)}`;
  const r = await placeCall(cfg, { to: t.phone, answerUrl: `${base}/api/vobiz/answer?${q}`, hangupUrl: `${base}/api/vobiz/hangup?${q}` });
  if (r.ok) {
    await updateAttempt(db, attemptId, { status: "dialing", callUuid: r.callUuid });
    return { ok: true, attemptId };
  }
  await updateAttempt(db, attemptId, { status: "failed", outcome: "error", detail: `${r.status} ${r.error}`.slice(0, 200) });
  return { ok: false, error: r.error };
}

export type OwnerCallResult = { ok: true; name: string; amountPaise: number } | { ok: false; message: string };

/**
 * The owner asked for this call (Voice Saathi / chat). Skips the day threshold and the master switch because the owner chose it,
 * but never skips consent, a phone number or the legal calling hours. Messages are Hinglish and safe to speak.
 */
export async function callCustomerNow(db: Db, merchantId: string, customerId: string, now = new Date()): Promise<OwnerCallResult> {
  const snap = await loadSnapshot(db, merchantId, { now });
  const acct = khataOverview(snap).accounts.find((a) => a.customerId === customerId);
  const cust = snap.customers.find((c) => c.id === customerId) as ((typeof snap.customers)[number] & { phone?: string | null; callConsent?: boolean }) | undefined;
  if (!acct || !cust || acct.outstandingPaise <= 0) return { ok: false, message: "Is customer ka koi udhaar baaki nahi hai." };
  if (!cust.phone) return { ok: false, message: `${cust.name} ka phone number save nahi hai. Call Saathi page par number daal dijiye.` };
  if (!cust.callConsent) return { ok: false, message: `${cust.name} ne call ki ijazat nahi di hai. Call Saathi page par ijazat chalu kijiye.` };
  const { fromHour, untilHour } = snap.settings.calls;
  if (!inCallingHours(now, fromHour, untilHour)) return { ok: false, message: `Abhi call ka samay nahi hai. Call subah ${fromHour} se shaam ${untilHour % 12 || 12} baje ke beech hi jaati hai.` };
  if (!numberAllowed(cust.phone)) return { ok: false, message: "Demo mode: call sirf approved number par hi lagti hai." };
  const cfg = vobizConfig();
  const base = webhookBase();
  const secret = process.env.VOBIZ_WEBHOOK_SECRET;
  if (!cfg || !base || !secret) return { ok: false, message: "Phone service abhi poori tarah set nahi hai, isliye call nahi lag sakti." };
  const r = await dialTarget(db, cfg, base, secret, merchantId, { customerId, phone: cust.phone, amountPaise: acct.outstandingPaise, overdueDays: acct.oldestUnpaidDays });
  return r.ok ? { ok: true, name: cust.name, amountPaise: acct.outstandingPaise } : { ok: false, message: `${cust.name} ko call nahi lagi. Thodi der baad dobara try kijiye.` };
}

export const callDoneText = (name: string, amountPaise: number) => `✅ ${name} ko ${rupees(amountPaise)} ke liye reminder call lag rahi hai.`;
