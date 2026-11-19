/**
 * IST helpers. Vercel runs in UTC, India has no DST (UTC+5:30), so we shift by a fixed
 * offset and read UTC fields. All "day" logic in the app goes through here.
 */
export const IST_OFFSET_MIN = 330;
const MS_MIN = 60_000;
export const MS_DAY = 86_400_000;

/** Date whose UTC fields equal the IST wall-clock of `d`. */
export function shiftIst(d: Date): Date {
  return new Date(d.getTime() + IST_OFFSET_MIN * MS_MIN);
}

/** 'YYYY-MM-DD' in IST. */
export function istDayKey(d: Date): string {
  return shiftIst(d).toISOString().slice(0, 10);
}

export function istHour(d: Date): number {
  return shiftIst(d).getUTCHours();
}

/** 0 = Sunday … 6 = Saturday (IST). */
export function istWeekday(d: Date): number {
  return shiftIst(d).getUTCDay();
}

/** Day-of-month in IST. */
export function istDom(d: Date): number {
  return shiftIst(d).getUTCDate();
}

/** UTC instant of 00:00 IST on the IST day of `d`. */
export function startOfIstDay(d: Date): Date {
  const s = shiftIst(d);
  const midnightShifted = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  return new Date(midnightShifted - IST_OFFSET_MIN * MS_MIN);
}

/** UTC instant for a 'YYYY-MM-DD' IST day (00:00 IST). */
export function istDayStart(key: string): Date {
  const [y, m, dd] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd) - IST_OFFSET_MIN * MS_MIN);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DAY);
}

/** Whole IST calendar days from a to b (b - a). */
export function istDaysBetween(a: Date, b: Date): number {
  return Math.round((startOfIstDay(b).getTime() - startOfIstDay(a).getTime()) / MS_DAY);
}

/** 'YYYY-MM-DD' list from `fromKey` through `toKey`, inclusive. */
export function dayKeysBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let t = istDayStart(fromKey).getTime();
  const end = istDayStart(toKey).getTime();
  while (t <= end) {
    out.push(istDayKey(new Date(t)));
    t += MS_DAY;
  }
  return out;
}

export type PeriodName =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_7_days"
  | "last_30_days"
  | "custom";

export interface Period {
  name: PeriodName;
  label: string;
  /** inclusive start instant */
  from: Date;
  /** exclusive end instant (for "today" this is `now`) */
  to: Date;
  /** previous equivalent period, used for "% vs previous" */
  prevFrom: Date;
  prevTo: Date;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtShortDate(d: Date): string {
  const s = shiftIst(d);
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`;
}

/** Monday-start week, IST. */
export function startOfIstWeek(d: Date): Date {
  const sod = startOfIstDay(d);
  const wd = istWeekday(sod); // 0=Sun
  const back = (wd + 6) % 7;
  return addDays(sod, -back);
}

export function startOfIstMonth(d: Date): Date {
  const s = shiftIst(d);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1) - IST_OFFSET_MIN * MS_MIN);
}

export function startOfPrevIstMonth(d: Date): Date {
  const s = shiftIst(d);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - 1, 1) - IST_OFFSET_MIN * MS_MIN);
}

/**
 * Resolve a named period in IST. Periods that include "now" are capped at `now`.
 * "Previous" is the same-length window shifted back (today/yesterday → 7 days back,
 * so it compares like weekday with like weekday: "pichle Thursday se").
 */
export function resolvePeriod(
  name: PeriodName,
  now: Date,
  custom?: { from: Date; to: Date },
): Period {
  const sod = startOfIstDay(now);
  switch (name) {
    case "today": {
      return {
        name,
        label: `Aaj (${fmtShortDate(now)})`,
        from: sod,
        to: now,
        prevFrom: addDays(sod, -7),
        prevTo: addDays(now, -7),
      };
    }
    case "yesterday": {
      const from = addDays(sod, -1);
      return {
        name,
        label: `Kal (${fmtShortDate(from)})`,
        from,
        to: sod,
        prevFrom: addDays(from, -7),
        prevTo: addDays(sod, -7),
      };
    }
    case "this_week": {
      const from = startOfIstWeek(now);
      const len = now.getTime() - from.getTime();
      return {
        name,
        label: "Is hafte",
        from,
        to: now,
        prevFrom: addDays(from, -7),
        prevTo: new Date(addDays(from, -7).getTime() + len),
      };
    }
    case "last_week": {
      const thisMon = startOfIstWeek(now);
      const from = addDays(thisMon, -7);
      return { name, label: "Pichla hafta", from, to: thisMon, prevFrom: addDays(from, -7), prevTo: from };
    }
    case "this_month": {
      const from = startOfIstMonth(now);
      const prevFrom = startOfPrevIstMonth(now);
      const len = now.getTime() - from.getTime();
      return { name, label: "Is mahine", from, to: now, prevFrom, prevTo: new Date(prevFrom.getTime() + len) };
    }
    case "last_month": {
      const from = startOfPrevIstMonth(now);
      const to = startOfIstMonth(now);
      const len = to.getTime() - from.getTime();
      return { name, label: "Pichla mahina", from, to, prevFrom: new Date(from.getTime() - len), prevTo: from };
    }
    case "last_7_days": {
      const from = addDays(sod, -6);
      const len = now.getTime() - from.getTime();
      return { name, label: "Pichhle 7 din", from, to: now, prevFrom: new Date(from.getTime() - len), prevTo: from };
    }
    case "last_30_days": {
      const from = addDays(sod, -29);
      const len = now.getTime() - from.getTime();
      return { name, label: "Pichhle 30 din", from, to: now, prevFrom: new Date(from.getTime() - len), prevTo: from };
    }
    case "custom": {
      if (!custom) throw new Error("custom period needs from/to");
      const from = startOfIstDay(custom.from);
      // `custom.to` is an inclusive day → exclusive end is the next midnight, capped at now
      const toExcl = addDays(startOfIstDay(custom.to), 1);
      const to = toExcl.getTime() > now.getTime() ? now : toExcl;
      const len = toExcl.getTime() - from.getTime();
      return {
        name,
        label: `${fmtShortDate(from)} – ${fmtShortDate(custom.to)}`,
        from,
        to,
        prevFrom: new Date(from.getTime() - len),
        prevTo: from,
      };
    }
  }
}

const PERIOD_NAMES: readonly string[] = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_7_days",
  "last_30_days",
  "custom",
];

export function isPeriodName(s: string): s is PeriodName {
  return PERIOD_NAMES.includes(s);
}
