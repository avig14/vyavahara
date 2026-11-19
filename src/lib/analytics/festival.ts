/** PRD B8.7 festival uplift: mean daily units in [D-7, D] ÷ mean of the previous 28 days, per category. */
import type { Snapshot } from "../domain";
import { mean, sum } from "../domain";
import { addDays, dayKeysBetween, istDayKey, istDayStart, istDaysBetween, startOfIstDay } from "../time";
import { ceilToPack } from "./forecast";
import { completeDayKeys, dailyUnits } from "./series";

export const DEFAULT_UPLIFT = 1.2;

/** Built-in calendar plus any festivals the merchant added in settings (same name+date wins from settings). */
export function allFestivals(snap: Snapshot) {
  const extra = snap.settings.festivals;
  const keys = new Set(extra.map((f) => `${f.name}|${f.date}`));
  return [...snap.festivals.filter((f) => !keys.has(`${f.name}|${f.date}`)), ...extra].sort((a, b) => a.date.localeCompare(b.date));
}
export const WINDOW_DAYS = 7;

export interface LearnedUplift {
  category: string;
  uplift: number;
  samples: { festival: string; uplift: number }[];
}

function categorySeries(snap: Snapshot, days = 120) {
  const u = dailyUnits(snap, days);
  const byCat = new Map<string, number[]>();
  for (const p of snap.products) {
    const arr = u.byProduct.get(p.id);
    if (!arr) continue;
    const acc = byCat.get(p.category) ?? new Array(days).fill(0);
    for (let i = 0; i < days; i++) acc[i] += arr[i];
    byCat.set(p.category, acc);
  }
  return { keys: u.keys, byCat, u };
}

export function learnUplifts(snap: Snapshot): Map<string, LearnedUplift> {
  const { keys, byCat } = categorySeries(snap);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const out = new Map<string, LearnedUplift>();
  const todayKey = istDayKey(snap.now);
  for (const f of allFestivals(snap)) {
    if (f.date >= todayKey) continue;
    const D = istDayStart(f.date);
    const win = dayKeysBetween(istDayKey(addDays(D, -WINDOW_DAYS)), f.date);
    const prev = dayKeysBetween(istDayKey(addDays(D, -(WINDOW_DAYS + 28))), istDayKey(addDays(D, -(WINDOW_DAYS + 1))));
    if (!win.every((k) => idx.has(k)) || !prev.every((k) => idx.has(k))) continue; // not fully inside history
    for (const cat of f.categories) {
      const arr = byCat.get(cat);
      if (!arr) continue;
      const w = mean(win.map((k) => arr[idx.get(k)!]));
      const b = mean(prev.map((k) => arr[idx.get(k)!]));
      if (b <= 0) continue;
      const cur = out.get(cat) ?? { category: cat, uplift: 1, samples: [] };
      cur.samples.push({ festival: f.name, uplift: w / b });
      cur.uplift = mean(cur.samples.map((s) => s.uplift));
      out.set(cat, cur);
    }
  }
  return out;
}

export interface UpcomingFestival {
  name: string;
  date: string;
  daysAway: number;
  categories: string[];
}

export function upcomingFestivals(snap: Snapshot, withinDays = 60): UpcomingFestival[] {
  const today = startOfIstDay(snap.now);
  return allFestivals(snap)
    .map((f) => ({ name: f.name, date: f.date, categories: f.categories, daysAway: istDaysBetween(today, istDayStart(f.date)) }))
    .filter((f) => f.daysAway >= 0 && f.daysAway <= withinDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

/** `(category, dateKey) → multiplier`, for the forecaster. Learned per category, else DEFAULT_UPLIFT. */
export function makeUplift(snap: Snapshot): (category: string, dateKey: string) => number {
  const learned = learnUplifts(snap);
  const todayKey = istDayKey(snap.now);
  const upcoming = allFestivals(snap).filter((f) => f.date >= todayKey);
  return (category, dateKey) => {
    let m = 1;
    for (const f of upcoming) {
      if (!f.categories.includes(category)) continue;
      const toD = istDaysBetween(istDayStart(dateKey), istDayStart(f.date));
      if (toD < 0 || toD > WINDOW_DAYS) continue;
      m = Math.max(m, Math.max(1, learned.get(category)?.uplift ?? DEFAULT_UPLIFT));
    }
    return m;
  };
}

export interface FestivalPlanItem {
  productId: string;
  name: string;
  category: string;
  baselinePerDay: number;
  uplift: number;
  learned: boolean;
  extraUnits: number;
  impactPaise: number;
}

export interface FestivalPlan {
  festival: UpcomingFestival;
  items: FestivalPlanItem[];
  totalImpactPaise: number;
}

/** Impact = Σ (uplift−1) × baseline × margin over the 8-day window (PRD B8.5). */
export function festivalPlan(snap: Snapshot, withinDays = 45): FestivalPlan[] {
  const learned = learnUplifts(snap);
  const keys = completeDayKeys(snap.now, 120);
  const units = dailyUnits(snap, 120);
  void keys;
  return upcomingFestivals(snap, withinDays).map((f) => {
    const items: FestivalPlanItem[] = [];
    for (const p of snap.products) {
      if (!f.categories.includes(p.category)) continue;
      const h = units.byProduct.get(p.id) ?? [];
      const base = mean(h.slice(-28));
      if (base <= 0) continue;
      const l = learned.get(p.category);
      const uplift = Math.max(1, l?.uplift ?? DEFAULT_UPLIFT);
      const extra = ceilToPack(base * (uplift - 1) * (WINDOW_DAYS + 1), p.packSize);
      const margin = p.pricePaise - p.costPaise;
      items.push({
        productId: p.id,
        name: p.name,
        category: p.category,
        baselinePerDay: base,
        uplift,
        learned: !!l,
        extraUnits: extra,
        impactPaise: Math.round(base * (uplift - 1) * (WINDOW_DAYS + 1) * margin),
      });
    }
    items.sort((a, b) => b.impactPaise - a.impactPaise);
    return { festival: f, items, totalImpactPaise: sum(items.map((i) => i.impactPaise)) };
  });
}
