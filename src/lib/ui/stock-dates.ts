import { monthName } from "./dlang";
/** Day labels for the stock and supplier screens. Dates arrive as `YYYY-MM-DD` IST keys or ISO instants; both print as "20 Nov" in IST. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const partsFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "numeric", timeZone: "Asia/Kolkata" });
const dayFmt = { format: (d: Date) => { const p = partsFmt.formatToParts(d); const day = p.find((x) => x.type === "day")?.value ?? ""; const m = Number(p.find((x) => x.type === "month")?.value ?? 1); return `${day} ${monthName(m - 1, MONTHS)}`; } };

/** `2026-11-20` becomes "20 Nov". Anything unparseable comes back as it was given. */
export function dayKeyLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d, 6)));
}

/** ISO instant to "7 Nov" in IST. */
export function instantLabel(iso: string): string {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : dayFmt.format(t);
}
