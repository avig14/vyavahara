/**
 * Soundbox basket reconciliation + payment-screenshot lookup. Pure. Tolerances from settings.ingest.
 * "UPI gives amounts, not items": find the item combination whose price sum matches the paid amount.
 */
import type { Snapshot, Txn } from "../domain";

export interface BasketLine {
  productId: string;
  name: string;
  qty: number;
  pricePaise: number;
}

export interface BasketMatch {
  lines: { productId: string; name: string; qty: number; pricePaise: number }[];
  sumPaise: number;
  /** |sum − amount| / amount */
  errorFrac: number;
}

const MAX_COMBOS = 200_000;

/**
 * Choose quantities (0..qty per line, at least one unit overall) whose price sum is within ±tolerancePct of amount.
 * Prefers the smallest error; ties go to the combination that explains more of the heard basket (more units).
 */
export function reconcileBasket(basket: BasketLine[], amountPaise: number, tolerancePct: number): BasketMatch | null {
  if (amountPaise <= 0 || !basket.length) return null;
  const tol = tolerancePct / 100;
  const lines = basket.filter((l) => l.qty > 0 && l.pricePaise > 0);
  let combos = 1;
  for (const l of lines) combos *= Math.ceil(l.qty) + 1;
  if (combos > MAX_COMBOS) return null;

  let best: { q: number[]; sum: number; err: number; units: number } | null = null;
  const q = new Array<number>(lines.length).fill(0);
  const walk = (i: number, sum: number, units: number) => {
    if (i === lines.length) {
      if (units === 0) return;
      const err = Math.abs(sum - amountPaise) / amountPaise;
      if (err > tol) return;
      if (!best || err < best.err - 1e-9 || (Math.abs(err - best.err) <= 1e-9 && units > best.units)) best = { q: [...q], sum, err, units };
      return;
    }
    for (let k = 0; k <= Math.ceil(lines[i].qty); k++) {
      q[i] = k;
      walk(i + 1, sum + k * lines[i].pricePaise, units + k);
    }
    q[i] = 0;
  };
  walk(0, 0, 0);
  if (!best) return null;
  const b = best as { q: number[]; sum: number; err: number };
  return {
    lines: lines.map((l, i) => ({ productId: l.productId, name: l.name, qty: b.q[i], pricePaise: l.pricePaise })).filter((l) => l.qty > 0),
    sumPaise: b.sum,
    errorFrac: b.err,
  };
}

export interface PaymentShot {
  amountPaise: number | null;
  utr: string | null;
  /** when the screenshot says it was paid */
  at: Date | null;
}

export type PaymentCheck =
  | { found: true; txn: Txn; by: "utr" | "amount+time" }
  | { found: false; reason: "unreadable" | "no_match" };

/** Look for the screenshot's payment in our UPI transactions. UTR match wins; else exact amount near the stated time. */
export function findPayment(snap: Snapshot, shot: PaymentShot, windowMin: number): PaymentCheck {
  if (shot.amountPaise === null && !shot.utr) return { found: false, reason: "unreadable" };
  const upi = snap.transactions.filter((t) => t.method === "upi" && t.kind === "sale");
  if (shot.utr) {
    const u = shot.utr.trim().toLowerCase();
    const hit = upi.find((t) => t.utr && t.utr.toLowerCase() === u);
    if (hit) return { found: true, txn: hit, by: "utr" };
  }
  if (shot.amountPaise !== null) {
    const ref = shot.at ?? null;
    const cands = upi
      .filter((t) => t.amountPaise === shot.amountPaise)
      .filter((t) => (ref ? Math.abs(t.createdAt.getTime() - ref.getTime()) <= windowMin * 60_000 : true))
      .sort((a, b) => (ref ? Math.abs(a.createdAt.getTime() - ref.getTime()) - Math.abs(b.createdAt.getTime() - ref.getTime()) : b.createdAt.getTime() - a.createdAt.getTime()));
    if (cands[0]) return { found: true, txn: cands[0], by: "amount+time" };
  }
  return { found: false, reason: "no_match" };
}
