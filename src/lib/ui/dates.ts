import { istDayKey, istDayStart, istWeekday, shiftIst } from "@/lib/time";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "6:28 pm" in IST, from an ISO instant. */
export function istClock(iso: string): string {
  const d = shiftIst(new Date(iso));
  const h24 = d.getUTCHours();
  const h = h24 % 12 || 12;
  return `${h}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h24 >= 12 ? "pm" : "am"}`;
}

/** "19 Nov" from a YYYY-MM-DD IST day key. */
export function shortDay(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Thu 19 Nov" from a YYYY-MM-DD IST day key. */
export function longDay(key: string): string {
  return `${DAYS_SHORT[istWeekday(istDayStart(key))]} ${shortDay(key)}`;
}

/** "19 Nov, 6:28 pm" in IST, from an ISO instant. */
export function istStamp(iso: string): string {
  return `${shortDay(istDayKey(new Date(iso)))}, ${istClock(iso)}`;
}

/** "6 pm" from an hour 0 to 23. */
export function hourWord(h: number): string {
  const h12 = h % 12 || 12;
  return `${h12} ${h >= 12 ? "pm" : "am"}`;
}
