import { dayName, localizeClock, monthName } from "./dlang";
/** Display labels for IST day keys and ISO instants. Display only: no date maths lives here. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const timeSecFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

function parts(key: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** "2026-12-25" -> "25 Dec" */
export function dayLabel(key: string): string {
  const p = parts(key);
  return p ? `${p[2]} ${monthName(p[1] - 1, MONTHS)}` : key;
}

/** "2026-12-25" -> "Fri, 25 Dec" */
export function dayLabelWeekday(key: string): string {
  const p = parts(key);
  if (!p) return key;
  return `${dayName(new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(), WEEKDAYS)}, ${p[2]} ${monthName(p[1] - 1, MONTHS)}`;
}

/** ISO instant -> "7:42 pm" in IST */
export function istTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(+d) ? "" : localizeClock(timeFmt.format(d).replace(/\s?([ap])m/i, (_, x: string) => ` ${x.toLowerCase()}m`));
}

/** Date -> "7:42:10 pm" in IST (for "updated at") */
export function istTimeSeconds(d: Date): string {
  return localizeClock(timeSecFmt.format(d).replace(/\s?([ap])m/i, (_, x: string) => ` ${x.toLowerCase()}m`));
}

/** "dry_fruits" -> "Dry fruits" */
export function humanize(s: string): string {
  const t = s.replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}
