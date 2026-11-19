import { num, rupees, rupeesExact } from "@/lib/format";
import type { RozmelRow } from "./types";

/** Whole rupees when the paise are zero, else exact paise: a day-book line should reconcile to the paisa. */
export function bookMoney(paise: number): string {
  return paise % 100 === 0 ? rupees(paise) : rupeesExact(paise);
}

const qtyText = (q: number) => num(q, q % 1 ? 1 : 0);

/** "Sugar 1kg ×3, Raisins 250g". A matched-but-unsure line says so. */
export function itemsText(items: RozmelRow["items"]): string {
  return items.map((i) => `${i.name}${i.qty !== 1 ? ` ×${qtyText(i.qty)}` : ""}${i.confidence === "probable" ? " (shayad)" : ""}`).join(", ");
}

export const METHOD_WORD: Record<RozmelRow["method"], string> = { upi: "UPI", cash: "Cash", card: "Card" };

const SOURCE_WORD: Partial<Record<RozmelRow["source"], string>> = { paytm: "Paytm", soundbox: "Soundbox", manual: "Haath se likha" };

/** "Paytm, UTR …5311": where the line came from. */
export function sourceText(row: RozmelRow): string {
  const parts = [SOURCE_WORD[row.source], row.utr ? `UTR …${row.utr.slice(-4)}` : null].filter(Boolean);
  return parts.join(", ");
}

export const qty = qtyText;
