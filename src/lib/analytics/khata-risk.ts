/** PRD B8.4 khata risk. FIFO-match payments to credits, then score. Pure. */
import type { Customer, KhataEntry, Snapshot } from "../domain";
import { sum } from "../domain";
import { addDays, istDaysBetween } from "../time";
import { rupees } from "../format";
import { DEFAULT_SETTINGS, type MerchantSettings } from "../settings";

type KhataCfg = MerchantSettings["khata"];

export type RiskBand = "green" | "amber" | "red";

export const BAND_EMOJI: Record<RiskBand, string> = { green: "🟢", amber: "🟡", red: "🔴" };
/** Default probability a rupee of outstanding comes back (PRD B8.3). Merchant can override in settings.khata.recovery. */
export const RECOVERY_P: Record<RiskBand, number> = DEFAULT_SETTINGS.khata.recovery;

export function bandOf(score: number, cfg: Pick<KhataCfg, "greenMax" | "amberMax"> = DEFAULT_SETTINGS.khata): RiskBand {
  if (score <= cfg.greenMax) return "green";
  if (score <= cfg.amberMax) return "amber";
  return "red";
}

export interface Ageing {
  d0_15: number;
  d16_30: number;
  d31_60: number;
  d60p: number;
}

export interface KhataAccount {
  customerId: string;
  name: string;
  outstandingPaise: number;
  creditLimitPaise: number;
  creditBlocked: boolean;
  oldestUnpaidDays: number;
  repayRatio90: number;
  utilization: number;
  daysSinceLastPayment: number;
  growing: boolean;
  score: number;
  band: RiskBand;
  emoji: string;
  reasons: string[];
  ageing: Ageing;
  suggestedLimitPaise: number;
  expectedRecoveryPaise: number;
  lastCreditAt: Date | null;
  lastPaymentAt: Date | null;
}

interface OpenCredit {
  at: Date;
  remaining: number;
}

/** FIFO: each payment clears the oldest open credits first. */
export function fifoOpenCredits(entries: KhataEntry[]): OpenCredit[] {
  const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const open: OpenCredit[] = [];
  for (const e of sorted) {
    if (e.type === "credit") {
      open.push({ at: e.createdAt, remaining: e.amountPaise });
      continue;
    }
    let pay = e.amountPaise;
    while (pay > 0 && open.length) {
      const head = open[0];
      const take = Math.min(head.remaining, pay);
      head.remaining -= take;
      pay -= take;
      if (head.remaining === 0) open.shift();
    }
  }
  return open;
}

const clamp1 = (x: number) => Math.min(1, Math.max(0, x));

export function scoreAccount(
  customer: Customer,
  entries: KhataEntry[],
  monthlyPurchasesPaise: number,
  now: Date,
  cfg: KhataCfg = DEFAULT_SETTINGS.khata,
): KhataAccount {
  const open = fifoOpenCredits(entries);
  const outstanding = sum(open.map((o) => o.remaining));
  const oldest = open.length ? istDaysBetween(open[0].at, now) : 0;

  const since90 = addDays(now, -90);
  const credits = entries.filter((e) => e.type === "credit");
  const payments = entries.filter((e) => e.type === "payment");
  const credit90 = sum(credits.filter((e) => e.createdAt >= since90).map((e) => e.amountPaise));
  const pay90 = sum(payments.filter((e) => e.createdAt >= since90).map((e) => e.amountPaise));
  const repay = credit90 > 0 ? clamp1(pay90 / credit90) : 1;

  const util = customer.creditLimitPaise > 0 ? outstanding / customer.creditLimitPaise : outstanding > 0 ? 1 : 0;

  const lastPay = payments.length ? payments.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)) : null;
  const lastCredit = credits.length ? credits.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)) : null;
  let daysSincePay = 0;
  if (outstanding > 0) {
    daysSincePay = lastPay
      ? istDaysBetween(lastPay.createdAt, now)
      : credits.length
        ? istDaysBetween(credits.reduce((a, b) => (a.createdAt < b.createdAt ? a : b)).createdAt, now)
        : 0;
  }

  const last30 = sum(credits.filter((e) => e.createdAt >= addDays(now, -30)).map((e) => e.amountPaise));
  const prev30 = sum(
    credits.filter((e) => e.createdAt >= addDays(now, -60) && e.createdAt < addDays(now, -30)).map((e) => e.amountPaise),
  );
  const growing = outstanding > 0 && last30 > 0 && last30 > prev30;

  const pts = {
    oldest: cfg.weights.oldest * clamp1(oldest / cfg.oldestFullDays),
    repay: cfg.weights.repay * (1 - repay),
    util: cfg.weights.utilization * clamp1(util),
    lastPay: cfg.weights.lastPayment * clamp1(daysSincePay / cfg.lastPaymentFullDays),
    growing: growing ? cfg.weights.growing : 0,
  };
  const score = outstanding > 0 ? Math.round(pts.oldest + pts.repay + pts.util + pts.lastPay + pts.growing) : 0;
  const band = bandOf(score, cfg);

  const reasonList: { pts: number; text: string }[] = [
    { pts: pts.oldest, text: `Sabse purana baaki ${oldest} din se` },
    { pts: pts.repay, text: `90 din mein sirf ${Math.round(repay * 100)}% wapas aaya` },
    { pts: pts.util, text: `Limit ka ${Math.round(Math.min(util, 9.99) * 100)}% use ho chuka` },
    { pts: pts.lastPay, text: lastPay ? `Aakhri payment ${daysSincePay} din pehle` : `Abhi tak koi payment nahi` },
    { pts: pts.growing, text: "Udhaar badhta ja raha hai" },
  ];
  const reasons = reasonList
    .filter((r) => r.pts >= 3)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 3)
    .map((r) => r.text);

  const ageing: Ageing = { d0_15: 0, d16_30: 0, d31_60: 0, d60p: 0 };
  for (const o of open) {
    const age = istDaysBetween(o.at, now);
    if (age <= 15) ageing.d0_15 += o.remaining;
    else if (age <= 30) ageing.d16_30 += o.remaining;
    else if (age <= 60) ageing.d31_60 += o.remaining;
    else ageing.d60p += o.remaining;
  }

  const suggested =
    band === "green"
      ? Math.max(customer.creditLimitPaise, Math.round((cfg.limitMultiplier * monthlyPurchasesPaise) / 10000) * 10000)
      : band === "red"
        ? 0
        : customer.creditLimitPaise;

  return {
    customerId: customer.id,
    name: customer.name,
    outstandingPaise: outstanding,
    creditLimitPaise: customer.creditLimitPaise,
    creditBlocked: customer.creditBlocked,
    oldestUnpaidDays: oldest,
    repayRatio90: repay,
    utilization: util,
    daysSinceLastPayment: daysSincePay,
    growing,
    score,
    band,
    emoji: BAND_EMOJI[band],
    reasons,
    ageing,
    suggestedLimitPaise: suggested,
    expectedRecoveryPaise: Math.round(outstanding * cfg.recovery[band]),
    lastCreditAt: lastCredit?.createdAt ?? null,
    lastPaymentAt: lastPay?.createdAt ?? null,
  };
}

export interface KhataOverview {
  accounts: KhataAccount[];
  totalOutstandingPaise: number;
  byBand: Record<RiskBand, { count: number; outstandingPaise: number }>;
  ageing: Ageing;
  expectedRecoveryPaise: number;
}

/** All customers with an open balance, riskiest first. */
export function khataOverview(snap: Snapshot): KhataOverview {
  const byCust = new Map<string, KhataEntry[]>();
  for (const e of snap.khata) byCust.set(e.customerId, [...(byCust.get(e.customerId) ?? []), e]);
  const since90 = addDays(snap.now, -90);
  const spend = new Map<string, number>();
  for (const t of snap.transactions)
    if (t.customerId && t.kind === "sale" && t.createdAt >= since90)
      spend.set(t.customerId, (spend.get(t.customerId) ?? 0) + t.amountPaise);

  const accounts: KhataAccount[] = [];
  for (const c of snap.customers) {
    const entries = byCust.get(c.id);
    if (!entries?.length) continue;
    const credit90 = sum(entries.filter((e) => e.type === "credit" && e.createdAt >= since90).map((e) => e.amountPaise));
    const monthly = ((spend.get(c.id) ?? 0) + credit90) / 3;
    const acc = scoreAccount(c, entries, monthly, snap.now, snap.settings.khata);
    if (acc.outstandingPaise > 0) accounts.push(acc);
  }
  accounts.sort((a, b) => b.score - a.score || b.outstandingPaise - a.outstandingPaise);

  const byBand: KhataOverview["byBand"] = {
    green: { count: 0, outstandingPaise: 0 },
    amber: { count: 0, outstandingPaise: 0 },
    red: { count: 0, outstandingPaise: 0 },
  };
  const ageing: Ageing = { d0_15: 0, d16_30: 0, d31_60: 0, d60p: 0 };
  for (const a of accounts) {
    byBand[a.band].count++;
    byBand[a.band].outstandingPaise += a.outstandingPaise;
    ageing.d0_15 += a.ageing.d0_15;
    ageing.d16_30 += a.ageing.d16_30;
    ageing.d31_60 += a.ageing.d31_60;
    ageing.d60p += a.ageing.d60p;
  }
  return {
    accounts,
    totalOutstandingPaise: sum(accounts.map((a) => a.outstandingPaise)),
    byBand,
    ageing,
    expectedRecoveryPaise: sum(accounts.map((a) => a.expectedRecoveryPaise)),
  };
}

/** One-line Hinglish summary used by menus and reminders. */
export function accountLine(a: KhataAccount): string {
  return `${a.emoji} ${a.name}: ${rupees(a.outstandingPaise)} baaki, sabse purana ${a.oldestUnpaidDays} din`;
}

/** Find a customer by name for tools. Exact → prefix → word prefix → substring. */
export function findAccountByName(accounts: KhataAccount[], q: string): KhataAccount | null {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  return (
    accounts.find((a) => a.name.toLowerCase() === s) ??
    accounts.find((a) => a.name.toLowerCase().startsWith(s)) ??
    accounts.find((a) => a.name.toLowerCase().split(" ").some((w) => w.startsWith(s))) ??
    accounts.find((a) => a.name.toLowerCase().includes(s)) ??
    null
  );
}
