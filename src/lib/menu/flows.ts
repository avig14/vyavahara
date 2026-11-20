/**
 * The "bot is waiting for your answer" steps behind menu leaves: pick a vendor, type "Suresh 300", give two dates...
 * Each handler gets the owner's raw text and either answers (and says what comes next) or returns null,
 * meaning "this is not an answer to my question" so the router can treat it as a normal message.
 * Risky writes (udhaar to a red customer, paying a vendor, stock changes) park a pending action and ask 1/2,
 * the same safety rule as the dashboard and the agent. No AI is called here.
 */
import type { Snapshot } from "../domain";
import { buildContext, type RecContext } from "../analytics/recommendations";
import { findAccountByName } from "../analytics/khata-risk";
import { openPayables } from "../analytics/cashflow";
import { reorderLines } from "../analytics/views";
import { confirmationMessage, udhaarGuard, type PendingPayload } from "../agent/actions";
import type { AgentStore } from "../agent/store";
import { findCustomer } from "../agent/tools";
import { buildMatcher } from "../ingest/match";
import { buildReport } from "../reports/build";
import { reportText } from "../reports/text";
import { num, rupees, toPaise } from "../format";
import { istDayStart, MS_DAY } from "../time";
import { dateRange, NAV, pickIndex, reminderText, type Awaiting } from "./menus";

export interface FlowEnv {
  snap: Snapshot;
  ctx?: RecContext;
  store: AgentStore;
  /** a public UPI pay page for the customer's dues; null when no public host is configured */
  payLink: (customerId: string, name: string, amountPaise: number) => Promise<string | null>;
}

export interface FlowResult {
  text: string;
  /** keep waiting for this (the same step again when the answer was bad) */
  next?: Awaiting;
}

const retry = (text: string, next: Awaiting): FlowResult => ({ text: `${text}\n\n${NAV}`, next });
const done = (text: string): FlowResult => ({ text: `${text}\n\n${NAV}` });

/** "1,200" / "₹300" / "rs 50.5" → rupees. null if not a clean positive number. */
export function parseRupees(s: string): number | null {
  const n = Number(s.replace(/[₹,\s]|rs\.?/gi, ""));
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? n : null;
}

const PAID_WORDS = /\b(mila|mile|mili|aaye|aaya|aayi|diye|diya\s*paisa|chuka|chukaya|paid|received|jama|wapas|payment|de\s*gaye|de\s*diye)\b/i;

export interface KhataEntryText {
  name: string;
  rupees: number;
  type: "credit" | "payment";
}

/** "Suresh 300" → udhaar; "Ramesh 500 mila" → payment. Name may be several words. null = not an entry. */
export function parseKhataEntry(raw: string): KhataEntryText | null {
  const t = raw.trim().replace(/\s+/g, " ");
  const m = t.match(/^(.+?)\s+(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)\s*(?:rs|rupaye|rupees|₹)?\s*(.*)$/i);
  if (!m) return null;
  const amount = parseRupees(m[2]);
  const name = m[1].replace(/\b(ko|ka|ke|se)$/i, "").trim();
  if (!amount || !name || /^\d+$/.test(name)) return null;
  return { name, rupees: amount, type: PAID_WORDS.test(m[3] ?? "") ? "payment" : "credit" };
}

/** "Maggi 24" / "maggi 24 packet" → item + quantity (negative with "-" or "kam"). */
export function parseStockEntry(raw: string): { item: string; qty: number } | null {
  const t = raw.trim().replace(/\s+/g, " ");
  const m = t.match(/^(.+?)\s+([+-]?\d+(?:\.\d+)?)\s*[a-zA-Z]*$/) ?? t.match(/^([+-]?\d+(?:\.\d+)?)\s*[a-zA-Z]*\s+(.+)$/);
  if (!m) return null;
  const leadingNumber = /^[+-]?\d/.test(m[1]);
  const item = (leadingNumber ? m[2] : m[1]).trim();
  const qty = Number(leadingNumber ? m[1] : m[2]);
  if (!item || !Number.isFinite(qty) || qty === 0) return null;
  return { item, qty };
}

export async function handleAwaiting(aw: Awaiting, raw: string, fx: FlowEnv): Promise<FlowResult | null> {
  const { snap } = fx;
  const ctx = fx.ctx ?? buildContext(snap);
  const propose = async (p: PendingPayload, reasons: string[] = []): Promise<FlowResult> => {
    await fx.store.createPending(p.kind, p);
    return { text: confirmationMessage(p, reasons) };
  };

  switch (aw.kind) {
    case "custom_dates": {
      const r = dateRange(raw, snap.now);
      if (!r) return retry("Dates samajh nahi aaye. Aise likho: _1/11 to 15/11_", aw);
      const custom = { from: istDayStart(r.from), to: new Date(istDayStart(r.to).getTime() + MS_DAY) };
      return done(reportText(buildReport(snap, { period: "custom", custom, ctx })));
    }

    case "pick_po": {
      const i = pickIndex(raw, aw.vendorIds.length);
      if (i === null) return null;
      const v = snap.vendors.find((x) => x.id === aw.vendorIds[i]);
      if (!v) return done("Vendor nahi mila.");
      const lines = reorderLines(snap, ctx).filter((x) => x.vendor?.id === v.id);
      if (!lines.length) return done(`${v.name} se abhi kuch order karne layak nahi hai ✅`);
      const unit = (id: string) => snap.products.find((p) => p.id === id)?.unit ?? "";
      const items = lines.map(({ f }) => ({ productId: f.productId, name: f.name, qty: f.suggestedOrderQty, unit: unit(f.productId) }));
      await fx.store.createPurchaseOrder(v.id, items);
      const forward = `Namaste ${v.name}, kripya yeh bhej dijiye:\n${items.map((x) => `• ${x.name} × ${num(x.qty, 0)} ${x.unit}`).join("\n")}\nDhanyavaad — ${snap.merchant.name}`;
      return done(`✅ ${v.name} ka order draft ban gaya (${items.length} items). Yeh message unhe forward karo:\n\n${forward}`);
    }

    case "pick_pay": {
      const i = pickIndex(raw, aw.purchaseIds.length);
      if (i === null) return null;
      const bill = openPayables(snap).find((p) => p.purchaseId === aw.purchaseIds[i]);
      if (!bill) return done("Yeh bill ab baaki nahi hai ✅");
      return propose({ kind: "pay_vendor", purchaseId: bill.purchaseId, vendorName: bill.vendorName, amountPaise: bill.amountPaise });
    }

    case "udhaar_entry": {
      const e = parseKhataEntry(raw);
      if (!e) return null;
      const c = findCustomer(snap, e.name);
      if (!c) return retry(`"${e.name}" naam ka customer nahi mila. Dobara likho (naam rakam).`, aw);
      const amountPaise = toPaise(e.rupees);
      if (e.type === "payment") {
        await fx.store.addKhataEntry({ customerId: c.id, type: "payment", amountPaise });
        const left = Math.max(0, (findAccountByName(ctx.khata.accounts, c.name)?.outstandingPaise ?? 0) - amountPaise);
        return done(`✅ ${c.name} se ${rupees(amountPaise)} mil gaye.${left > 0 ? ` Ab ${rupees(left)} baaki.` : " Hisaab saaf ✅"}`);
      }
      const g = udhaarGuard(ctx.khata, c, amountPaise);
      if (g.risky) return propose({ kind: "udhaar", customerId: c.id, name: c.name, amountPaise }, g.reasons);
      await fx.store.addKhataEntry({ customerId: c.id, type: "credit", amountPaise });
      return done(`✅ ${c.name} ke naam ${rupees(amountPaise)} udhaar likh diya.\nGalti ho gayi? Dashboard se theek kar sakte hain.`);
    }

    case "pick_reminder": {
      const i = pickIndex(raw, aw.customerIds.length);
      if (i === null) return null;
      const a = ctx.khata.accounts.find((x) => x.customerId === aw.customerIds[i]);
      if (!a) return done("Is customer ka koi udhaar baaki nahi ✅");
      const link = await fx.payLink(a.customerId, a.name, a.outstandingPaise);
      return done(`📨 Yeh message *${a.name}* ko forward karo:\n\n${reminderText(snap, a, link)}`);
    }

    case "stock_add": {
      const e = parseStockEntry(raw);
      if (!e) return null;
      const matcher = buildMatcher(snap.products.filter((p) => p.isActive), snap.settings.ingest.matchMaxScore);
      const m = matcher.match(e.item);
      if (!m) {
        const sug = matcher.suggest(e.item, 3).map((x) => x.product.name);
        return retry(`"${e.item}" naam ka item nahi mila.${sug.length ? ` Shayad: ${sug.join(", ")}` : ""}`, aw);
      }
      return propose({ kind: "adjust_stock", productId: m.product.id, name: m.product.name, delta: e.qty, unit: m.product.unit });
    }

    case "alert": {
      const c = raw.trim();
      if (c === "1") return propose({ kind: "block_credit", customerId: aw.customerId, name: aw.name, blocked: true });
      if (c === "2") {
        const a = ctx.khata.accounts.find((x) => x.customerId === aw.customerId);
        if (!a) return done(`${aw.name} ka udhaar ab baaki nahi ✅`);
        const link = await fx.payLink(a.customerId, a.name, a.outstandingPaise);
        return done(`📨 Yeh message *${a.name}* ko forward karo:\n\n${reminderText(snap, a, link)}`);
      }
      if (c === "3") return done(`Theek hai, *${aw.name}* ka alert ignore kiya.`);
      return null;
    }

    case "screenshot":
      return null; // an image answers this, not text
  }
}
