import { getCtx, handle, HttpError, json, readJson } from "@/lib/server/http";
import { loadDash } from "@/lib/server/dash";
import { listAttempts, recentAttempts, setCustomerContact } from "@/lib/calls/store";
import { selectCallCandidates } from "@/lib/calls/select";
import { normalizeIndianPhone, vobizConfig } from "@/lib/calls/vobiz";
import { khataOverview } from "@/lib/analytics/khata-risk";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Reasons from the selector, said the way the owner talks. */
function hinglish(r: string | undefined): string | null {
  if (!r) return null;
  const days = /^overdue (\d+)d, threshold (\d+)d$/.exec(r);
  if (days) return `Abhi ${days[1]} din hue, ${days[2]} din par call hogi`;
  const map: Record<string, string> = {
    "balance below minimum": "Baaki bahut kam hai",
    "no phone number": "Phone number chahiye",
    "no call consent": "Ijazat chahiye",
    "max attempts reached": "Zyada se zyada calls ho chuki",
    "called recently": "Haal hi mein call gayi",
    "promised to pay, waiting": "Dene ka vaada kiya hai",
    "run limit": "Agli baar",
  };
  return map[r] ?? r;
}

/** Call Saathi screen: settings, who would be called and why not, recent calls, and whether Vobiz is configured. */
export const GET = () =>
  handle(async () => {
    const c = await getCtx();
    const d = await loadDash(c);
    const snap = d.snap;
    const attempts = await recentAttempts(c.db, c.merchantId, 90, c.now);
    const { candidates, skipped } = selectCallCandidates(snap, attempts, c.now, { preview: true });
    const will = new Set(candidates.map((x) => x.customerId));
    const why = new Map(skipped.map((x) => [x.customerId, x.reason]));
    const byId = new Map(snap.customers.map((x) => [x.id, x as typeof x & { phone?: string | null; callConsent?: boolean }]));
    const last = new Map<string, Date>();
    for (const a of attempts) if (!last.has(a.customerId) || a.createdAt > last.get(a.customerId)!) last.set(a.customerId, a.createdAt);
    const count = new Map<string, number>();
    for (const a of attempts) count.set(a.customerId, (count.get(a.customerId) ?? 0) + 1);

    const customers = khataOverview(snap).accounts.map((a) => ({
      customerId: a.customerId,
      name: a.name,
      outstandingPaise: a.outstandingPaise,
      oldestUnpaidDays: a.oldestUnpaidDays,
      phone: byId.get(a.customerId)?.phone ?? null,
      callConsent: byId.get(a.customerId)?.callConsent ?? false,
      willCall: will.has(a.customerId),
      reason: will.has(a.customerId) ? null : hinglish(why.get(a.customerId)),
      attempts: count.get(a.customerId) ?? 0,
      lastCallAt: last.get(a.customerId)?.toISOString() ?? null,
    }));

    const names = new Map(snap.customers.map((x) => [x.id, x.name]));
    const rows = await listAttempts(c.db, c.merchantId, 100); // newest first
    const asc = [...rows].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
    const nth = new Map<string, number>(); // call number per customer, oldest = 1
    const nextAt = new Map<string, Date>(); // when the same customer was called next
    const seen = new Map<string, number>();
    const prev = new Map<string, string>();
    for (const a of asc) {
      const n = (seen.get(a.customerId) ?? 0) + 1;
      seen.set(a.customerId, n);
      nth.set(a.id, n);
      const p = prev.get(a.customerId);
      if (p) nextAt.set(p, a.createdAt);
      prev.set(a.customerId, a.id);
    }
    /** money that came in after the call (until the next call, at most 14 days): did the call work? */
    const paidAfter = (customerId: string, from: Date, id: string) => {
      const end = Math.min(nextAt.get(id)?.getTime() ?? c.now.getTime(), from.getTime() + 14 * 86_400_000);
      return snap.khata.filter((e) => e.customerId === customerId && e.type === "payment" && e.createdAt > from && e.createdAt.getTime() <= end).reduce((t, e) => t + e.amountPaise, 0);
    };
    const history = rows.map((a) => ({
      id: a.id,
      customerId: a.customerId,
      customer: names.get(a.customerId) ?? "Customer",
      amountPaise: a.amountPaise,
      overdueDays: a.overdueDays,
      status: a.status,
      outcome: a.outcome,
      durationSec: a.durationSec,
      callNo: nth.get(a.id) ?? 1,
      paidAfterPaise: paidAfter(a.customerId, a.createdAt, a.id),
      at: a.createdAt.toISOString(),
    }));
    const lastOutcome = new Map<string, string | null>();
    for (const a of asc) lastOutcome.set(a.customerId, a.outcome);
    const weekAgo = c.now.getTime() - 7 * 86_400_000;
    const week = history.filter((h) => new Date(h.at).getTime() >= weekAgo);
    const summary = {
      weekCalls: week.length,
      weekCustomers: new Set(week.map((h) => h.customerId)).size,
      willPay: week.filter((h) => h.outcome === "will_pay").length,
      callBack: week.filter((h) => h.outcome === "call_back").length,
      noAnswer: week.filter((h) => h.outcome === "no_answer" || h.outcome === "no_response").length,
      paidAfterPaise: week.reduce((t, h) => t + h.paidAfterPaise, 0),
    };

    return json({ calls: snap.settings.calls, vobizReady: vobizConfig() !== null, customers: customers.map((x) => ({ ...x, lastOutcome: lastOutcome.get(x.customerId) ?? null })), history, summary });
  });

/** Save one customer's phone number and call consent. `{ customerId, phone?, callConsent? }`. */
export const PUT = (req: Request) =>
  handle(async () => {
    const c = await getCtx();
    const b = (await readJson(req)) as { customerId?: unknown; phone?: unknown; callConsent?: unknown };
    if (typeof b.customerId !== "string") throw new HttpError(400, "customerId is required");
    const patch: { phone?: string | null; callConsent?: boolean } = {};
    if (b.phone !== undefined) {
      if (b.phone === null || b.phone === "") patch.phone = null;
      else {
        const p = typeof b.phone === "string" ? normalizeIndianPhone(b.phone) : null;
        if (!p) throw new HttpError(400, "Enter a 10-digit Indian mobile number");
        patch.phone = p;
      }
    }
    if (b.callConsent !== undefined) {
      if (typeof b.callConsent !== "boolean") throw new HttpError(400, "callConsent must be true or false");
      patch.callConsent = b.callConsent;
    }
    await setCustomerContact(c.db, c.merchantId, b.customerId, patch);
    return json({ ok: true, ...patch });
  });
