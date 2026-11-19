/** PRD B8.6 anomalies: sales vs same weekday/hour, refund spike, item sales collapse. Pure. Thresholds from settings.anomalies. */
import type { Snapshot } from "../domain";
import { mean, stdev, sum } from "../domain";
import { addDays, istDayKey, istDayStart, istWeekday, startOfIstDay } from "../time";
import { rupees } from "../format";
import { isIntermittent, wmaWeekday } from "./forecast";
import { dailyUnits } from "./series";

export interface SalesAnomaly {
  kind: "sales_dip" | "sales_spike";
  todayPaise: number;
  expectedPaise: number;
  z: number;
  deltaPct: number;
  weeksUsed: number;
  text: string;
}

export interface RefundAnomaly {
  kind: "refund_spike";
  todayPaise: number;
  avgDailyPaise: number;
  multiple: number;
  count: number;
  text: string;
}

export interface ItemDropAnomaly {
  kind: "item_drop";
  productId: string;
  name: string;
  actualUnits: number;
  expectedUnits: number;
  share: number;
  text: string;
}

export type Anomaly = SalesAnomaly | RefundAnomaly | ItemDropAnomaly;

function saleSum(snap: Snapshot, from: Date, to: Date): number {
  let s = 0;
  for (const t of snap.transactions) if (t.kind === "sale" && t.createdAt >= from && t.createdAt <= to) s += t.amountPaise;
  return s;
}

/** Today so far vs the same weekday up to the same time of day over the last 8 weeks. */
export function salesAnomaly(snap: Snapshot): SalesAnomaly | null {
  const cfg = snap.settings.anomalies;
  const dayStart = startOfIstDay(snap.now);
  const elapsed = snap.now.getTime() - dayStart.getTime();
  const today = saleSum(snap, dayStart, snap.now);
  const prev: number[] = [];
  for (let w = 1; w <= 8; w++) {
    const d = addDays(dayStart, -7 * w);
    prev.push(saleSum(snap, d, new Date(d.getTime() + elapsed)));
  }
  const usable = prev.filter((x) => x > 0);
  if (usable.length < 4) return null;
  const mu = mean(usable);
  const sd = stdev(usable);
  if (sd <= 0 || mu <= 0) return null;
  const z = (today - mu) / sd;
  const deltaPct = (today - mu) / mu;
  const strong = Math.abs(z) >= cfg.zThreshold;
  const soft = z <= -cfg.zThreshold / 2 && deltaPct <= -cfg.salesDipPct;
  if (!strong && !soft) return null;
  const dip = z < 0;
  return {
    kind: dip ? "sales_dip" : "sales_spike",
    todayPaise: today,
    expectedPaise: Math.round(mu),
    z,
    deltaPct,
    weeksUsed: usable.length,
    text: `Aaj ab tak ${rupees(today)} ki sales, normal ${rupees(Math.round(mu))} se ${Math.abs(Math.round(deltaPct * 100))}% ${dip ? "kam" : "zyada"}`,
  };
}

/** Today's refunds ≥ N× the usual daily refund amount (last 30 complete days, zero days included). */
export function refundAnomaly(snap: Snapshot): RefundAnomaly | null {
  const cfg = snap.settings.anomalies;
  const todayKey = istDayKey(snap.now);
  const from = istDayKey(addDays(snap.now, -30));
  let todayAmt = 0;
  let count = 0;
  let past = 0;
  for (const t of snap.transactions) {
    if (t.kind !== "refund") continue;
    const k = istDayKey(t.createdAt);
    if (k === todayKey) {
      todayAmt += t.amountPaise;
      count++;
    } else if (k >= from) past += t.amountPaise;
  }
  const avg = past / 30;
  if (todayAmt <= 0 || avg <= 0) return null;
  const multiple = todayAmt / avg;
  if (multiple < cfg.refundMultiple) return null;
  return {
    kind: "refund_spike",
    todayPaise: todayAmt,
    avgDailyPaise: Math.round(avg),
    multiple,
    count,
    text: `Aaj ${count} refund, ${rupees(todayAmt)} — roz ke average ${rupees(Math.round(avg))} se ${multiple.toFixed(1)}× zyada`,
  };
}

/** Items that sold < share of what the model expected for each of the last 3 complete days (in total). */
export function itemDropAnomalies(snap: Snapshot): ItemDropAnomaly[] {
  const cfg = snap.settings.anomalies;
  const u = dailyUnits(snap, 120);
  const dow0 = istWeekday(istDayStart(u.keys[0]));
  const out: ItemDropAnomaly[] = [];
  for (const p of snap.products) {
    if (!p.isActive || p.stockQty <= 0) continue; // stockouts are explained elsewhere
    const y = u.byProduct.get(p.id);
    if (!y) continue;
    const train = y.slice(0, -3);
    if (isIntermittent(train) || sum(train.slice(-28)) === 0) continue;
    const expected = sum(wmaWeekday(train, 3, dow0));
    const actual = sum(y.slice(-3));
    if (expected < 6) continue; // too little volume to judge
    const share = actual / expected;
    if (share >= cfg.itemDropShare) continue;
    out.push({
      kind: "item_drop",
      productId: p.id,
      name: p.name,
      actualUnits: actual,
      expectedUnits: Math.round(expected),
      share,
      text: `${p.name}: pichhle 3 din mein ${actual} bika, expected ~${Math.round(expected)} (${Math.round(share * 100)}%)`,
    });
  }
  return out.sort((a, b) => a.share - b.share);
}

export function detectAnomalies(snap: Snapshot): Anomaly[] {
  const out: Anomaly[] = [];
  const s = salesAnomaly(snap);
  if (s) out.push(s);
  const r = refundAnomaly(snap);
  if (r) out.push(r);
  out.push(...itemDropAnomalies(snap));
  return out;
}
