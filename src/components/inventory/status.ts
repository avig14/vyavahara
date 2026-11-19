import type { BadgeTone } from "@/components/ui";
import { num } from "@/lib/format";
import type { StockStatus } from "./types";

export const STATUS_ORDER: readonly StockStatus[] = ["stockout", "reorder", "ok", "overstock", "dead"];

/** What the badge says. The word carries the meaning; tone only backs it up. */
export const STATUS_META: Record<StockStatus, { label: string; tone: BadgeTone }> = {
  stockout: { label: "Khatam", tone: "danger" },
  reorder: { label: "Order karo", tone: "warn" },
  ok: { label: "Theek hai", tone: "neutral" },
  overstock: { label: "Zyada stock", tone: "info" },
  dead: { label: "Bik nahi raha", tone: "neutral" },
};

export function isStatus(v: string | null): v is StockStatus {
  return v !== null && (STATUS_ORDER as readonly string[]).includes(v);
}

/** The forecast engine caps days at 99; print the cap as "99+". */
const CAP = 99;

/** Days of cover for a table cell. */
export function coverLabel(days: number): string {
  if (days <= 0) return "0 din";
  if (days >= CAP) return `${CAP}+ din`;
  if (days < 1) return "1 din se kam";
  return `${num(days, days < 10 ? 1 : 0)} din`;
}

export function daysText(days: number): string {
  return days >= CAP ? `${CAP}+ din` : `${num(days, 1)} din`;
}
