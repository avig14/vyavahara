import { HI_DAYS_FULL, dayName, isHindi, meridiem, monthName } from "./dlang";
import { istDayKey, istDayStart, istWeekday, shiftIst } from "@/lib/time";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Full weekday names in the current language; index with 0 = Sunday. */
export const DAYS_FULL = new Proxy(DAYS_FULL_EN, { get: (t, k) => (typeof k === "string" && /^\d+$/.test(k) ? (isHindi() ? HI_DAYS_FULL[Number(k)] : t[Number(k)]) : Reflect.get(t, k)) });

/** "6:28 pm" in IST, from an ISO instant. */
export function istClock(iso: string): string {
  const d = shiftIst(new Date(iso));
  const h24 = d.getUTCHours();
  const h = h24 % 12 || 12;
  return `${h}:${String(d.getUTCMinutes()).padStart(2, "0")} ${meridiem(h24 >= 12)}`;
}

/** "19 Nov" from a YYYY-MM-DD IST day key. */
export function shortDay(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${monthName(m - 1, MONTHS)}`;
}

/** "Thu 19 Nov" from a YYYY-MM-DD IST day key. */
export function longDay(key: string): string {
  return `${dayName(istWeekday(istDayStart(key)), DAYS_SHORT)} ${shortDay(key)}`;
}

/** "19 Nov, 6:28 pm" in IST, from an ISO instant. */
export function istStamp(iso: string): string {
  return `${shortDay(istDayKey(new Date(iso)))}, ${istClock(iso)}`;
}

/** "6 pm" from an hour 0 to 23. */
export function hourWord(h: number): string {
  const h12 = h % 12 || 12;
  return `${h12} ${meridiem(h >= 12)}`;
}
