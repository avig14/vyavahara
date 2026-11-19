import type { Snapshot } from "../domain";
import { addDays, dayKeysBetween, istDayKey } from "../time";

/** Complete IST days only: `days` keys ending yesterday (today is partial and handled separately). */
export function completeDayKeys(now: Date, days: number): string[] {
  return dayKeysBetween(istDayKey(addDays(now, -days)), istDayKey(addDays(now, -1)));
}

export interface UnitSeries {
  keys: string[];
  byProduct: Map<string, number[]>;
  soldToday: Map<string, number>;
}

/** Zero-filled daily units per product. */
export function dailyUnits(snap: Snapshot, days = 120): UnitSeries {
  const keys = completeDayKeys(snap.now, days);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const todayKey = istDayKey(snap.now);
  const byProduct = new Map<string, number[]>();
  for (const p of snap.products) byProduct.set(p.id, new Array(days).fill(0));
  const soldToday = new Map<string, number>();
  for (const si of snap.saleItems) {
    const k = istDayKey(si.createdAt);
    if (k === todayKey) {
      soldToday.set(si.productId, (soldToday.get(si.productId) ?? 0) + si.qty);
      continue;
    }
    const i = idx.get(k);
    if (i === undefined) continue;
    const arr = byProduct.get(si.productId);
    if (arr) arr[i] += si.qty;
  }
  return { keys, byProduct, soldToday };
}

export interface RevenueSeries {
  keys: string[];
  /** net of refunds, paise */
  net: number[];
  upi: number[];
  cash: number[];
  todaySoFar: number;
}

export function dailyRevenue(snap: Snapshot, days = 120): RevenueSeries {
  const keys = completeDayKeys(snap.now, days);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const todayKey = istDayKey(snap.now);
  const net = new Array(days).fill(0);
  const upi = new Array(days).fill(0);
  const cash = new Array(days).fill(0);
  let todaySoFar = 0;
  for (const t of snap.transactions) {
    const sign = t.kind === "refund" ? -1 : 1;
    const k = istDayKey(t.createdAt);
    if (k === todayKey) {
      todaySoFar += sign * t.amountPaise;
      continue;
    }
    const i = idx.get(k);
    if (i === undefined) continue;
    net[i] += sign * t.amountPaise;
    if (t.method === "upi") upi[i] += sign * t.amountPaise;
    else cash[i] += sign * t.amountPaise;
  }
  return { keys, net, upi, cash, todaySoFar };
}
