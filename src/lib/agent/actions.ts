/**
 * Pending actions (PRD write-safety): risky writes are proposed, the owner replies 1 (do it) or 2 (cancel).
 * Pure message building + guard here; the DB bits are in queries.ts.
 */
import { rupees, num } from "../format";
import type { Customer } from "../domain";
import type { KhataOverview } from "../analytics/khata-risk";
import type { Db } from "../db/client";
import { getOpenPending, resolvePending, type PendingKind } from "../db/queries";
import { dbStore, type AgentStore } from "./store";
import { callDoneText } from "../calls/dial";

export type PendingPayload =
  | { kind: "block_credit"; customerId: string; name: string; blocked: boolean }
  | { kind: "set_limit"; customerId: string; name: string; limitPaise: number }
  | { kind: "adjust_stock"; productId: string; name: string; delta: number; unit: string }
  | { kind: "udhaar"; customerId: string; name: string; amountPaise: number; note?: string }
  | { kind: "call_customer"; customerId: string; name: string; amountPaise: number; overdueDays: number }
  | { kind: "pay_vendor"; purchaseId: string; vendorName: string; amountPaise: number }
  | { kind: "create_po"; vendorId: string; vendorName: string; items: { productId: string; name: string; qty: number; unit: string }[] }
  | {
      kind: "stock_in";
      vendorId: string;
      vendorName: string;
      invoiceNo: string | null;
      invoiceDate: string;
      dueDate: string;
      totalPaise: number;
      items: { productId: string; name: string; qty: number; unitCostPaise: number }[];
    };

export const CONFIRM_SUFFIX = "\n\n*1* = Haan, kar do\n*2* = Nahi, rehne do";

/** The question shown to the owner. All numbers formatted by code. */
export function confirmationMessage(p: PendingPayload, reasons: string[] = []): string {
  const why = reasons.length ? `\n${reasons.map((r) => `• ${r}`).join("\n")}` : "";
  switch (p.kind) {
    case "block_credit":
      return `${p.blocked ? "🚫" : "✅"} ${p.name} ka udhaar ${p.blocked ? "band" : "dobara chalu"} karun?${why}${CONFIRM_SUFFIX}`;
    case "set_limit":
      return `${p.name} ki udhaar limit ${rupees(p.limitPaise)} karun?${why}${CONFIRM_SUFFIX}`;
    case "adjust_stock":
      return `${p.name} ka stock ${p.delta > 0 ? "+" : ""}${num(p.delta, 1)} ${p.unit} badlun?${why}${CONFIRM_SUFFIX}`;
    case "udhaar":
      return `⚠️ ${p.name} ke naam ${rupees(p.amountPaise)} udhaar likhna hai.${why}\nLikh dun?${CONFIRM_SUFFIX}`;
    case "call_customer":
      return `📞 ${p.name} ko ${rupees(p.amountPaise)} ({days} din se) ke liye reminder call lagaun?${CONFIRM_SUFFIX}`.replace("{days}", String(p.overdueDays));
    case "pay_vendor":
      return `${p.vendorName} ko ${rupees(p.amountPaise)} ka payment mark karun?${CONFIRM_SUFFIX}`;
    case "create_po":
      return `${p.vendorName} ke liye order draft banau (${p.items.length} items)?${CONFIRM_SUFFIX}`;
    case "stock_in":
      return (
        `📦 Bill padha — ${p.vendorName}${p.invoiceNo ? ` #${p.invoiceNo}` : ""}, total ${rupees(p.totalPaise)}\n` +
        p.items.slice(0, 8).map((i) => `• ${i.name} × ${num(i.qty, 1)} @ ${rupees(i.unitCostPaise)}`).join("\n") +
        (p.items.length > 8 ? `\n• …aur ${p.items.length - 8} items` : "") +
        `\nStock aur purchase rate update karun?${CONFIRM_SUFFIX}`
      );
  }
}

/** Run the confirmed action. Returns the reply text. */
export async function executePending(store: AgentStore, p: PendingPayload): Promise<string> {
  switch (p.kind) {
    case "block_credit":
      await store.setCreditBlocked(p.customerId, p.blocked);
      return p.blocked ? `🚫 ${p.name} ka udhaar band kar diya.` : `✅ ${p.name} ka udhaar dobara chalu.`;
    case "set_limit":
      await store.setCreditLimit(p.customerId, p.limitPaise);
      return `✅ ${p.name} ki limit ${rupees(p.limitPaise)} set.`;
    case "adjust_stock":
      await store.adjustStock({ productId: p.productId, delta: p.delta, reason: "adjust" });
      return `✅ ${p.name} ka stock ${p.delta > 0 ? "+" : ""}${num(p.delta, 1)} ${p.unit} update.`;
    case "udhaar":
      await store.addKhataEntry({ customerId: p.customerId, type: "credit", amountPaise: p.amountPaise, note: p.note });
      return `✅ ${p.name} ke naam ${rupees(p.amountPaise)} udhaar likh diya.`;
    case "call_customer": {
      if (!store.callCustomer) return "Call abhi yahan se nahi ho sakti.";
      const r = await store.callCustomer(p.customerId);
      return r.ok ? callDoneText(r.name, r.amountPaise) : r.message;
    }
    case "pay_vendor":
      await store.payVendorBill(p.purchaseId, p.amountPaise);
      return `✅ ${p.vendorName} ko ${rupees(p.amountPaise)} ka payment mark kiya.`;
    case "create_po":
      await store.createPurchaseOrder(p.vendorId, p.items);
      return `✅ ${p.vendorName} ka order draft ban gaya (${p.items.length} items).`;
    case "stock_in":
      await store.receiveBill({
        vendorId: p.vendorId,
        invoiceNo: p.invoiceNo,
        invoiceDate: p.invoiceDate,
        dueDate: p.dueDate,
        totalPaise: p.totalPaise,
        items: p.items.map((i) => ({ productId: i.productId, qty: i.qty, unitCostPaise: i.unitCostPaise })),
      });
      return `✅ Stock update ho gaya (${p.items.length} items). ${p.vendorName} ka ${rupees(p.totalPaise)} baaki me add.`;
  }
}

/* ---------------- udhaar guard ---------------- */

export interface UdhaarGuard {
  risky: boolean;
  reasons: string[];
}

/** Risky when: credit blocked, customer is red, or the new balance would pass their limit. Limit 0 = no limit set. */
export function udhaarGuard(khata: KhataOverview, customer: Customer, amountPaise: number): UdhaarGuard {
  const reasons: string[] = [];
  const acct = khata.accounts.find((a) => a.customerId === customer.id);
  if (customer.creditBlocked) reasons.push("Iska udhaar pehle se band hai");
  if (acct?.band === "red") reasons.push(`High risk hai — ${rupees(acct.outstandingPaise)} pehle se baaki, ${acct.oldestUnpaidDays} din purana`);
  const limit = customer.creditLimitPaise;
  const after = (acct?.outstandingPaise ?? 0) + amountPaise;
  if (limit > 0 && after > limit) reasons.push(`Limit ${rupees(limit)} hai, isse total ${rupees(after)} ho jayega`);
  return { risky: reasons.length > 0, reasons };
}

/* ---------------- 1 / 2 reply handling (shared by WhatsApp router and web chat) ---------------- */

export function parseChoice(text: string): 1 | 2 | null {
  const t = text.trim().toLowerCase().replace(/[.!\s]+$/g, "");
  if (["1", "haan", "han", "ha", "yes", "ok", "okay", "kar do", "kardo"].includes(t)) return 1;
  if (["2", "nahi", "nahin", "no", "cancel", "rehne do", "mat karo"].includes(t)) return 2;
  return null;
}

export type ChoiceResult = { handled: false } | { handled: true; reply: string };

export type PendingRow = { id: string; kind: string; payload: unknown };

/** Claim the action first (so a double click cannot run it twice), then run or cancel it. */
export async function applyChoice(db: Db, merchantId: string, row: PendingRow, choice: 1 | 2): Promise<string | null> {
  const p = { kind: row.kind as PendingKind, ...(row.payload as object) } as PendingPayload;
  if (!(await resolvePending(db, merchantId, row.id, choice === 1 ? "confirmed" : "cancelled"))) return null;
  if (choice === 2) return "Theek hai, cancel kar diya.";
  try {
    return await executePending(dbStore(db, merchantId, "owner"), p);
  } catch (e) {
    await resolvePending(db, merchantId, row.id, "open"); // let the owner retry
    throw e;
  }
}

/** If the owner's message is 1/2 and an action is waiting, run or cancel it. Otherwise handled:false → go to the agent. */
export async function resolveChoice(db: Db, merchantId: string, text: string, now = new Date()): Promise<ChoiceResult> {
  const choice = parseChoice(text);
  if (!choice) return { handled: false };
  const row = await getOpenPending(db, merchantId, now);
  if (!row) return { handled: false };
  const reply = await applyChoice(db, merchantId, row, choice);
  return reply === null ? { handled: false } : { handled: true, reply };
}
