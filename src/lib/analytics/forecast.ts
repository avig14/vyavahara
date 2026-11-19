/**
 * PRD B8.1 item forecast. Pure TS. Series are zero-filled daily values, oldest → newest,
 * ending YESTERDAY; step 1 = today. `dow0` = weekday (0=Sun) of y[0].
 */
import type { Snapshot } from "../domain";
import { addDays, istDayKey, istDayStart, istWeekday, startOfIstDay } from "../time";
import { dailyUnits } from "./series";
import { mean, sum } from "../domain";
import { DEFAULT_SETTINGS, type MerchantSettings } from "../settings";

export type ModelName = "seasonal_naive" | "wma14_weekday" | "holt_winters" | "croston_sba";
type Model = (y: number[], h: number, dow0: number) => number[];

const clamp0 = (x: number) => (x > 0 ? x : 0);

export function seasonalNaive(y: number[], h: number): number[] {
  const n = y.length;
  if (n < 7) return new Array(h).fill(mean(y));
  return Array.from({ length: h }, (_, k) => y[n - 7 + (k % 7)]);
}

/** Weekday index = mean of that weekday (last 8 weeks) ÷ overall mean of those days. */
export function weekdayIndex(y: number[], dow0: number): number[] {
  const n = y.length;
  const from = Math.max(0, n - 56);
  const sums = new Array(7).fill(0);
  const cnt = new Array(7).fill(0);
  for (let i = from; i < n; i++) {
    const d = (dow0 + i) % 7;
    sums[d] += y[i];
    cnt[d]++;
  }
  const overall = mean(y.slice(from));
  if (overall <= 0) return new Array(7).fill(1);
  return sums.map((s, d) => (cnt[d] ? s / cnt[d] / overall : 1));
}

export function wmaWeekday(y: number[], h: number, dow0: number): number[] {
  const n = y.length;
  if (n < 14) return new Array(h).fill(mean(y));
  const idx = weekdayIndex(y, dow0);
  let num = 0;
  let den = 0;
  for (let w = 1; w <= 14; w++) {
    const i = n - 14 + (w - 1); // weight 1 oldest … 14 newest
    const ix = idx[(dow0 + i) % 7] || 1;
    num += w * (y[i] / ix);
    den += w;
  }
  const level = num / den;
  return Array.from({ length: h }, (_, k) => clamp0(level * idx[(dow0 + n + k) % 7]));
}

const ALPHAS = [0.1, 0.2, 0.3, 0.5];
const BETAS = [0, 0.05, 0.1];
const GAMMAS = [0.1, 0.3];

/** Additive Holt-Winters, m=7, grid on one-step SSE (PRD init). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- keeps the Model signature
export function holtWinters(y: number[], h: number, _dow0: number): number[] {
  const n = y.length;
  if (n < 14) return new Array(h).fill(mean(y));
  const w1 = mean(y.slice(0, 7));
  const w2 = mean(y.slice(7, 14));
  const b0 = (w2 - w1) / 7;
  let best: { sse: number; l: number; b: number; s: number[] } | null = null;
  for (const a of ALPHAS)
    for (const be of BETAS)
      for (const g of GAMMAS) {
        let l = w1;
        let b = b0;
        const s = Array.from({ length: 7 }, (_, i) => y[i] - w1);
        let sse = 0;
        for (let t = 7; t < n; t++) {
          const si = t % 7;
          const f = l + b + s[si];
          const e = y[t] - f;
          sse += e * e;
          const lNew = a * (y[t] - s[si]) + (1 - a) * (l + b);
          b = be * (lNew - l) + (1 - be) * b;
          s[si] = g * (y[t] - lNew) + (1 - g) * s[si];
          l = lNew;
        }
        if (!best || sse < best.sse) best = { sse, l, b, s };
      }
  const { l, b, s } = best!;
  return Array.from({ length: h }, (_, k) => {
    const step = k + 1;
    return clamp0(l + Math.min(step, 14) * b + s[(n - 1 + step) % 7]);
  });
}

/** Croston with Syntetos-Boylan bias correction, α = 0.1. */
export function crostonSba(y: number[], h: number, alpha = 0.1): number[] {
  let z = 0;
  let p = 0;
  let q = 1;
  let init = false;
  for (const v of y) {
    if (v > 0) {
      if (!init) {
        z = v;
        p = q;
        init = true;
      } else {
        z = alpha * v + (1 - alpha) * z;
        p = alpha * q + (1 - alpha) * p;
      }
      q = 1;
    } else q++;
  }
  const yhat = init ? (1 - alpha / 2) * (z / p) : 0;
  return new Array(h).fill(yhat);
}

const MODELS: Record<Exclude<ModelName, "croston_sba">, Model> = {
  wma14_weekday: (y, h, d) => wmaWeekday(y, h, d),
  holt_winters: (y, h, d) => holtWinters(y, h, d),
  seasonal_naive: (y, h) => seasonalNaive(y, h),
};

export interface Backtest {
  model: ModelName;
  mae: number;
  wape: number;
  /** RMSE of one-step backtest residuals */
  sigma: number;
}

export function isIntermittent(y: number[]): boolean {
  if (!y.length) return false;
  return y.filter((v) => v === 0).length / y.length > 0.4;
}

function backtestModel(y: number[], dow0: number, run: Model, origins = 14) {
  const n = y.length;
  const res: number[] = [];
  let absSum = 0;
  let actual = 0;
  for (let o = n - origins; o < n; o++) {
    const yhat = run(y.slice(0, o), 1, dow0)[0];
    const e = y[o] - yhat;
    res.push(e);
    absSum += Math.abs(e);
    actual += y[o];
  }
  return {
    mae: absSum / res.length,
    wape: actual > 0 ? absSum / actual : 0,
    sigma: Math.sqrt(mean(res.map((e) => e * e))),
  };
}

/** Pick the model with the lowest MAE over the last 14 one-step origins. */
export function selectModel(y: number[], dow0: number): Backtest {
  if (y.length < 28) {
    const bt = backtestModel(y, dow0, (yy, h) => new Array(h).fill(mean(yy)), Math.min(7, Math.floor(y.length / 2)));
    return { model: "seasonal_naive", ...bt };
  }
  if (isIntermittent(y)) {
    const bt = backtestModel(y, dow0, (yy, h) => crostonSba(yy, h));
    return { model: "croston_sba", ...bt };
  }
  let best: Backtest | null = null;
  for (const name of Object.keys(MODELS) as Exclude<ModelName, "croston_sba">[]) {
    const bt = backtestModel(y, dow0, MODELS[name]);
    if (!best || bt.mae < best.mae) best = { model: name, ...bt };
  }
  return best!;
}

export function runModel(model: ModelName, y: number[], h: number, dow0: number): number[] {
  return model === "croston_sba" ? crostonSba(y, h) : MODELS[model](y, h, dow0);
}

export function ceilToPack(qty: number, pack: number): number {
  if (qty <= 0) return 0;
  return pack > 1 ? Math.ceil(qty / pack) * pack : Math.ceil(qty);
}

export type StockStatus = "stockout" | "reorder" | "ok" | "overstock" | "dead";

export interface ForecastPoint {
  date: string;
  yhat: number;
  lo: number;
  hi: number;
}

export interface ItemForecast {
  productId: string;
  name: string;
  category: string;
  model: ModelName;
  mae: number;
  wape: number;
  sigma: number;
  daily: ForecastPoint[];
  stock: number;
  soldToday: number;
  daysToStockout: number;
  daysToStockoutRange: [number, number];
  safetyStock: number;
  reorderPoint: number;
  suggestedOrderQty: number;
  leadTimeDays: number;
  coverDays: number;
  status: StockStatus;
}

/** Days until stock runs out starting from now, given daily demand and what has already sold today. */
export function daysUntilStockout(stock: number, daily: number[], soldToday: number): number {
  if (stock <= 0) return 0;
  let left = stock;
  let t = 0;
  for (let k = 0; k < daily.length; k++) {
    const full = daily[k];
    const demand = k === 0 ? Math.max(0, full - soldToday) : full;
    const len = k === 0 ? (full > 0 ? Math.min(1, demand / full) : 0) : 1;
    if (demand <= 0) {
      t += len;
      continue;
    }
    if (left <= demand) return t + (left / demand) * len;
    left -= demand;
    t += len;
  }
  return Infinity;
}

export interface ItemForecastInput {
  productId: string;
  name: string;
  category: string;
  history: number[];
  dow0: number;
  stock: number;
  soldToday: number;
  leadTimeDays: number;
  packSize: number;
  /** date 'YYYY-MM-DD' → multiplier (festival uplift) */
  uplift?: (dateKey: string) => number;
  now: Date;
  horizon?: number;
  /** merchant-tunable thresholds; defaults to DEFAULT_SETTINGS.inventory */
  cfg?: MerchantSettings["inventory"];
}

const Z80 = 1.28;
const CAP = 99;

export function forecastItem(inp: ItemForecastInput): ItemForecast {
  const cfg = inp.cfg ?? DEFAULT_SETTINGS.inventory;
  const H = Math.max(inp.horizon ?? 14, inp.leadTimeDays + 7);
  const bt = selectModel(inp.history, inp.dow0);
  const base = runModel(bt.model, inp.history, H, inp.dow0);
  const sigma = bt.sigma;
  const today = startOfIstDay(inp.now);
  const daily: ForecastPoint[] = base.map((yh, k) => {
    const key = istDayKey(addDays(today, k));
    const up = inp.uplift?.(key) ?? 1;
    const y = yh * up;
    const band = Z80 * sigma * Math.sqrt(k + 1) * up;
    return { date: key, yhat: y, lo: clamp0(y - band), hi: y + band };
  });

  const yhats = daily.map((d) => d.yhat);
  const days = daysUntilStockout(inp.stock, yhats, inp.soldToday);
  const fast = daysUntilStockout(inp.stock, daily.map((d) => d.hi), inp.soldToday);
  const slow = daysUntilStockout(inp.stock, daily.map((d) => d.lo), inp.soldToday);
  const L = inp.leadTimeDays;
  const safety = cfg.serviceLevelZ * sigma * Math.sqrt(L);
  const rop = sum(yhats.slice(0, L)) + safety;
  const need = sum(yhats.slice(0, L + cfg.reviewBufferDays)) + safety - inp.stock;
  const order = ceilToPack(need, inp.packSize);
  const meanDemand = mean(yhats.slice(0, 14));
  const cover = meanDemand > 0 ? inp.stock / meanDemand : Infinity;
  const lastN = sum(inp.history.slice(-cfg.deadStockDays));

  let status: StockStatus = "ok";
  if (inp.stock <= 0) status = "stockout";
  else if (lastN === 0) status = "dead";
  else if (inp.stock <= rop) status = "reorder";
  else if (cover > cfg.overstockCoverDays) status = "overstock";

  return {
    productId: inp.productId,
    name: inp.name,
    category: inp.category,
    model: bt.model,
    mae: bt.mae,
    wape: bt.wape,
    sigma,
    daily,
    stock: inp.stock,
    soldToday: inp.soldToday,
    daysToStockout: Math.min(days, CAP),
    daysToStockoutRange: [Math.min(Math.min(fast, slow), CAP), Math.min(Math.max(fast, slow), CAP)],
    safetyStock: safety,
    reorderPoint: rop,
    suggestedOrderQty: status === "dead" || status === "overstock" ? 0 : order,
    leadTimeDays: L,
    coverDays: Math.min(cover, CAP),
    status,
  };
}

/** Forecast every active product. `uplift(category, dateKey)` comes from festival.ts. */
export function forecastAll(
  snap: Snapshot,
  uplift?: (category: string, dateKey: string) => number,
  horizon = snap.settings.inventory.horizonDays,
): ItemForecast[] {
  const units = dailyUnits(snap, 120);
  const dow0 = istWeekday(istDayStart(units.keys[0]));
  const vendorOfProduct = new Map<string, number>();
  const leadByVendor = new Map(snap.vendors.map((v) => [v.id, v.leadTimeDays]));
  // primary vendor = the one with the most purchase lines for the product
  const counts = new Map<string, Map<string, number>>();
  const purchaseVendor = new Map(snap.purchases.map((p) => [p.id, p.vendorId]));
  for (const it of snap.purchaseItems) {
    const v = purchaseVendor.get(it.purchaseId);
    if (!v) continue;
    const m = counts.get(it.productId) ?? new Map<string, number>();
    m.set(v, (m.get(v) ?? 0) + 1);
    counts.set(it.productId, m);
  }
  for (const [pid, m] of counts) {
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    vendorOfProduct.set(pid, leadByVendor.get(top[0]) ?? 2);
  }
  return snap.products
    .filter((p) => p.isActive)
    .map((p) =>
      forecastItem({
        productId: p.id,
        name: p.name,
        category: p.category,
        history: units.byProduct.get(p.id) ?? [],
        dow0,
        stock: p.stockQty,
        soldToday: units.soldToday.get(p.id) ?? 0,
        leadTimeDays: vendorOfProduct.get(p.id) ?? 2,
        packSize: p.packSize,
        uplift: uplift ? (k) => uplift(p.category, k) : undefined,
        now: snap.now,
        horizon,
        cfg: snap.settings.inventory,
      }),
    );
}
