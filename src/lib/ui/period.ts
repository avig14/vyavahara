"use client";

import { useMemo } from "react";
import { addDays, istDayKey, istDayStart, isPeriodName, type PeriodName } from "@/lib/time";
import { useQueryParams } from "./url-state";
import { useLang } from "./lang";
import type { Lang } from "./i18n";

/** Same names as `PeriodName` in `src/lib/time.ts`; labels are the ones `resolvePeriod` prints, minus the date. */
export const PERIOD_OPTIONS: readonly { name: PeriodName; label: string }[] = [
  { name: "today", label: "Aaj" },
  { name: "yesterday", label: "Kal" },
  { name: "this_week", label: "Is hafte" },
  { name: "last_week", label: "Pichla hafta" },
  { name: "this_month", label: "Is mahine" },
  { name: "last_month", label: "Pichla mahina" },
  { name: "last_7_days", label: "Pichhle 7 din" },
  { name: "last_30_days", label: "Pichhle 30 din" },
  { name: "custom", label: "Custom" },
];

const PERIOD_TEXT: Record<PeriodName, { en: string; hi: string }> = {
  today: { en: "Today", hi: "आज" },
  yesterday: { en: "Yesterday", hi: "कल" },
  this_week: { en: "This week", hi: "इस हफ़्ते" },
  last_week: { en: "Last week", hi: "पिछला हफ़्ता" },
  this_month: { en: "This month", hi: "इस महीने" },
  last_month: { en: "Last month", hi: "पिछला महीना" },
  last_7_days: { en: "Last 7 days", hi: "पिछले 7 दिन" },
  last_30_days: { en: "Last 30 days", hi: "पिछले 30 दिन" },
  custom: { en: "Custom", hi: "अपनी तारीख़ें" },
};

/** Period name in the chosen language; Hinglish is the original label. */
export function periodLabelFor(name: PeriodName, lang: Lang): string {
  return lang === "hing" ? periodLabel(name) : PERIOD_TEXT[name][lang];
}

export const DEFAULT_PERIOD: PeriodName = "today";

export function periodLabel(name: PeriodName): string {
  return PERIOD_OPTIONS.find((p) => p.name === name)?.label ?? "Aaj";
}

export interface PeriodState {
  name: PeriodName;
  /** `YYYY-MM-DD` IST day keys, only for `custom` */
  from: string | null;
  to: string | null;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Query string the dashboard routes read: `period=this_week` or `period=custom&from=ISO&to=ISO`. */
export function periodApiQuery(p: PeriodState): string {
  if (p.name !== "custom" || !p.from || !p.to) return `period=${p.name === "custom" ? DEFAULT_PERIOD : p.name}`;
  // `to` is an inclusive day; noon IST keeps it on that day and strictly after `from` even for a one-day range
  const from = istDayStart(p.from).toISOString();
  const to = new Date(istDayStart(p.to).getTime() + 12 * 3_600_000).toISOString();
  return `period=custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

/** Today's IST day key, for `max` on date inputs. */
export function todayKey(): string {
  return istDayKey(new Date());
}

export function defaultCustomRange(): { from: string; to: string } {
  const now = new Date();
  return { from: istDayKey(addDays(now, -6)), to: istDayKey(now) };
}

export interface UsePeriod extends PeriodState {
  label: string;
  /** ready to append: `/api/dashboard/overview?${apiQuery}` */
  apiQuery: string;
  setPeriod: (name: PeriodName) => void;
  setCustom: (from: string, to: string) => void;
}

/** Period in the URL (`?period=`, plus `from`/`to` for custom). Absent means today. */
export function usePeriod(): UsePeriod {
  const { get, patch } = useQueryParams();
  const { lang } = useLang();
  const rawName = get("period");
  const rawFrom = get("from");
  const rawTo = get("to");

  const state = useMemo<PeriodState>(() => {
    const name: PeriodName = rawName && isPeriodName(rawName) ? rawName : DEFAULT_PERIOD;
    if (name !== "custom") return { name, from: null, to: null };
    if (rawFrom && rawTo && DAY_KEY.test(rawFrom) && DAY_KEY.test(rawTo) && rawFrom <= rawTo) return { name, from: rawFrom, to: rawTo };
    return { name: DEFAULT_PERIOD, from: null, to: null };
  }, [rawName, rawFrom, rawTo]);

  return {
    ...state,
    label: periodLabelFor(state.name, lang),
    apiQuery: periodApiQuery(state),
    setPeriod: (name) => {
      if (name === "custom") {
        const r = defaultCustomRange();
        patch({ period: "custom", from: r.from, to: r.to });
      } else patch({ period: name === DEFAULT_PERIOD ? null : name, from: null, to: null });
    },
    setCustom: (from, to) => patch({ period: "custom", from, to }),
  };
}
