/** IST date labels for ledgers. The API sends ISO instants; India has no DST, so Asia/Kolkata is exact. */
const IST = "Asia/Kolkata";

const dayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST });
const dayMonthYear = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST });
const yearOf = new Intl.DateTimeFormat("en-IN", { year: "numeric", timeZone: IST });

/** "14 Nov", or "14 Nov 2025" when the year is not the current IST year. */
export function istDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return yearOf.format(d) === yearOf.format(new Date()) ? dayMonth.format(d) : dayMonthYear.format(d);
}

/** Whole days ago in Hinglish: "aaj", "kal", "5 din pehle". */
export function daysAgo(n: number): string {
  if (n <= 0) return "Aaj";
  if (n === 1) return "Kal";
  return `${n} din pehle`;
}
