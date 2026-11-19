/** Money is integer paise everywhere; format only at the edge. */
const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹12,340 (rounded to the rupee). */
export function rupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  return `${sign}₹${inr0.format(Math.round(Math.abs(paise) / 100))}`;
}

/** ₹28.50 (exact paise), for single-payment announcements. */
export function rupeesExact(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  return `${sign}₹${inr2.format(Math.abs(paise) / 100)}`;
}

export function pct(n: number, digits = 0): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function num(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(n);
}

/** Hinglish days-left label. */
export function daysLabel(d: number): string {
  if (!isFinite(d)) return "bahut din";
  if (d < 1) return "aaj hi";
  return `${Math.round(d)} din`;
}

/** Paise from a rupee amount typed by the user. */
export function toPaise(rupeeAmount: number): number {
  return Math.round(rupeeAmount * 100);
}
