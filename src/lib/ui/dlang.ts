import type { Lang } from "./i18n";

/**
 * Which language date and time words are printed in. LangProvider sets it while rendering, before any child reads it,
 * so the pure label helpers (dates.ts, ist-labels.ts, stock-dates.ts, date.ts) can stay plain functions.
 * Hindi gets Devanagari month, weekday and am/pm words; English and Hinglish keep the Latin ones.
 */
let current: Lang = "hing";
export const setDateLang = (l: Lang) => {
  current = l;
};
export const isHindi = () => current === "hi";

export const HI_MONTHS = ["जन॰", "फ़र॰", "मार्च", "अप्रैल", "मई", "जून", "जुल॰", "अग॰", "सित॰", "अक्टू॰", "नव॰", "दिस॰"];
export const HI_DAYS = ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"];
export const HI_DAYS_FULL = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];

export const monthName = (i: number, en: readonly string[]) => (isHindi() ? HI_MONTHS[i] : en[i]);
export const dayName = (i: number, en: readonly string[]) => (isHindi() ? HI_DAYS[i] : en[i]);
export const meridiem = (pm: boolean) => (isHindi() ? (pm ? "अपराह्न" : "पूर्वाह्न") : pm ? "pm" : "am");
/** Rewrites a formatted "7:42 pm" for the current language. */
export const localizeClock = (t: string) => (isHindi() ? t.replace(/\s?([ap])m/i, (_, x: string) => ` ${meridiem(x.toLowerCase() === "p")}`) : t);
