import type { L } from "@/lib/ui/lang";
import { num, rupees, rupeesExact } from "@/lib/format";
import type { RozmelRow } from "./types";

/** Whole rupees when the paise are zero, else exact paise: a day-book line should reconcile to the paisa. */
export function bookMoney(paise: number): string {
  return paise % 100 === 0 ? rupees(paise) : rupeesExact(paise);
}

const qtyText = (q: number) => num(q, q % 1 ? 1 : 0);

/** "Sugar 1kg ×3, Raisins 250g". A matched-but-unsure line says so. */
export function itemsText(items: RozmelRow["items"], l: L): string {
  return items.map((i) => `${i.name}${i.qty !== 1 ? ` ×${qtyText(i.qty)}` : ""}${i.confidence === "probable" ? ` (${l("maybe", "शायद", "shayad")})` : ""}`).join(", ");
}

export const METHOD_WORD: Record<RozmelRow["method"], string> = { upi: "UPI", cash: "Cash", card: "Card" };

const sourceWord = (l: L): Partial<Record<RozmelRow["source"], string>> => ({ paytm: "Paytm", soundbox: l("Soundbox", "साउंडबॉक्स", "Soundbox"), manual: l("Written by hand", "हाथ से लिखा", "Haath se likha") });

/** "Paytm, UTR …5311": where the line came from. */
export function sourceText(row: RozmelRow, l: L): string {
  const parts = [sourceWord(l)[row.source], row.utr ? `UTR …${row.utr.slice(-4)}` : null].filter(Boolean);
  return parts.join(", ");
}

export const qty = qtyText;
