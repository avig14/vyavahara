import type { BadgeTone } from "@/components/ui";
import { num } from "@/lib/format";
import type { L } from "@/lib/ui/lang";
import type { StockStatus } from "./types";

export const STATUS_ORDER: readonly StockStatus[] = [
  "stockout",
  "reorder",
  "ok",
  "overstock",
  "dead",
];

/** What the badge says. The word carries the meaning; tone only backs it up. */
export function statusMeta(
  l: L,
): Record<StockStatus, { label: string; tone: BadgeTone }> {
  return {
    stockout: { label: l("Out", "ख़त्म", "Khatam"), tone: "danger" },
    reorder: { label: l("Order now", "ऑर्डर करें", "Order karo"), tone: "warn" },
    ok: { label: l("Fine", "ठीक है", "Theek hai"), tone: "neutral" },
    overstock: {
      label: l("Too much stock", "ज़्यादा स्टॉक", "Zyada stock"),
      tone: "info",
    },
    dead: {
      label: l("Not selling", "बिक नहीं रहा", "Bik nahi raha"),
      tone: "neutral",
    },
  };
}

export function isStatus(v: string | null): v is StockStatus {
  return v !== null && (STATUS_ORDER as readonly string[]).includes(v);
}

/** The forecast engine caps days at 99; print the cap as "99+". */
const CAP = 99;

const unit = (l: L) => l("days", "दिन", "din");

/** Days of cover for a table cell. */
export function coverLabel(days: number, l: L): string {
  if (days <= 0) return `0 ${unit(l)}`;
  if (days >= CAP) return `${CAP}+ ${unit(l)}`;
  if (days < 1) return l("less than 1 day", "1 दिन से कम", "1 din se kam");
  return `${num(days, days < 10 ? 1 : 0)} ${unit(l)}`;
}

export function daysText(days: number, l: L): string {
  return days >= CAP ? `${CAP}+ ${unit(l)}` : `${num(days, 1)} ${unit(l)}`;
}
