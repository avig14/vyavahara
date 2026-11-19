/** Day labels for the stock and supplier screens. Dates arrive as `YYYY-MM-DD` IST keys or ISO instants; both print as "20 Nov" in IST. */
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

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
