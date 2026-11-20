/** Call Saathi: who should get a reminder call right now. Pure, every threshold from settings.calls. */
import type { Snapshot } from "../domain";
import { khataOverview } from "../analytics/khata-risk";
import { MS_DAY, istHour } from "../time";

export interface PastAttempt {
  customerId: string;
  createdAt: Date;
  outcome: string | null;
}

export interface CallCandidate {
  customerId: string;
  name: string;
  phone: string;
  amountPaise: number;
  overdueDays: number;
}

export interface SkipReason {
  customerId: string;
  name: string;
  reason: string;
}

/** Calls are allowed only inside the merchant's calling window (IST). */
export function inCallingHours(now: Date, from: number, until: number): boolean {
  const h = istHour(now);
  return h >= from && h < until;
}

export function selectCallCandidates(
  snap: Snapshot,
  attempts: PastAttempt[],
  now: Date = snap.now,
  /** preview = for the dashboard: ignore the master switch and the clock, only explain who would be called and why not */
  opts: { preview?: boolean } = {},
): { candidates: CallCandidate[]; skipped: SkipReason[] } {
  const cfg = snap.settings.calls;
  const out = { candidates: [] as CallCandidate[], skipped: [] as SkipReason[] };
  if (!opts.preview && (!cfg.enabled || !inCallingHours(now, cfg.fromHour, cfg.untilHour))) return out;

  type Row = (typeof snap.customers)[number] & { phone?: string | null; callConsent?: boolean };
  const byId = new Map<string, Row>(snap.customers.map((c) => [c.id, c as Row]));
  const mine = new Map<string, PastAttempt[]>();
  for (const a of attempts) mine.set(a.customerId, [...(mine.get(a.customerId) ?? []), a]);

  const accounts = khataOverview(snap).accounts.sort(
    (a, b) => b.oldestUnpaidDays - a.oldestUnpaidDays || b.outstandingPaise - a.outstandingPaise,
  );
  for (const a of accounts) {
    const skip = (reason: string) => out.skipped.push({ customerId: a.customerId, name: a.name, reason });
    const c = byId.get(a.customerId);
    if (a.outstandingPaise < Math.max(1, cfg.minOutstandingPaise)) { skip("balance below minimum"); continue; }
    if (a.oldestUnpaidDays < cfg.minOverdueDays) { skip(`overdue ${a.oldestUnpaidDays}d, threshold ${cfg.minOverdueDays}d`); continue; }
    if (!c?.phone) { skip("no phone number"); continue; }
    if (!c.callConsent) { skip("no call consent"); continue; }
    const past = (mine.get(a.customerId) ?? []).sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
    if (past.length >= cfg.maxAttempts) { skip("max attempts reached"); continue; }
    if (past[0] && now.getTime() - past[0].createdAt.getTime() < cfg.retryGapDays * MS_DAY) { skip("called recently"); continue; }
    if (past[0]?.outcome === "will_pay" && now.getTime() - past[0].createdAt.getTime() < 7 * MS_DAY) { skip("promised to pay, waiting"); continue; }
    if (out.candidates.length >= cfg.maxCallsPerRun) { skip("run limit"); continue; }
    out.candidates.push({ customerId: a.customerId, name: a.name, phone: c.phone, amountPaise: a.outstandingPaise, overdueDays: a.oldestUnpaidDays });
  }
  return out;
}
