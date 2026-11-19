/**
 * Soundbox flow (PRD B9). Heard words → catalog items → held basket. Payment amount → closest basket → item-level sale.
 * Planning is pure (tested); `heard` / `paid` wire it to the DB. Audio is never stored: only the transcript and parsed items.
 */
import type { Db } from "../db/client";
import type { Product, Snapshot } from "../domain";
import type { SoundboxParseT } from "../ingest/vision";
import { buildMatcher } from "../ingest/match";
import { reconcileBasket, type BasketLine } from "../ingest/reconcile";
import { loadSnapshot, openSoundboxBaskets, recordLostDemand, recordSoundboxSale, saveSoundboxEvent } from "../db/queries";

export interface HeardItem {
  productId: string;
  name: string;
  qty: number;
  pricePaise: number;
  costPaise: number;
}

export interface UtterancePlan {
  matched: HeardItem[];
  unmatched: string[];
  /** wanted more than we have → lost-demand rows */
  lost: { productId: string; name: string; qty: number; estValuePaise: number }[];
}

/** Pure: parsed speech + catalog → what we understood. Out-of-stock asks become lost demand. */
export function planUtterance(products: Product[], parsed: SoundboxParseT, maxScore: number): UtterancePlan {
  const m = buildMatcher(products.filter((p) => p.isActive), maxScore);
  const matched: HeardItem[] = [];
  const unmatched: string[] = [];
  const lost: UtterancePlan["lost"] = [];
  for (const it of parsed.items) {
    const hit = m.match(it.name);
    const qty = it.qty > 0 ? it.qty : 1;
    if (!hit) {
      unmatched.push(it.name);
      continue;
    }
    const p = hit.product;
    matched.push({ productId: p.id, name: p.name, qty, pricePaise: p.pricePaise, costPaise: p.costPaise });
    if (p.stockQty < qty) {
      const short = qty - Math.max(0, p.stockQty);
      lost.push({ productId: p.id, name: p.name, qty: short, estValuePaise: Math.round(short * p.pricePaise) });
    }
  }
  return { matched, unmatched, lost };
}

export interface HeldBasket {
  id: string;
  items: HeardItem[];
}

export interface PaymentPlan {
  lines: { productId: string; qty: number; pricePaise: number; costPaise: number }[];
  confidence: "confirmed" | "probable";
  matchedBasket: boolean;
  eventIds: string[];
  /** names of lines attributed to this payment, for the owner-facing summary */
  summary: string[];
}

/** Pure: held baskets + paid amount → item-level sale. No basket within tolerance → payment recorded without items. */
export function planPayment(baskets: HeldBasket[], amountPaise: number, tolerancePct: number): PaymentPlan {
  const merged = new Map<string, BasketLine & { costPaise: number }>();
  for (const b of baskets)
    for (const i of b.items) {
      const cur = merged.get(i.productId);
      if (cur) cur.qty += i.qty;
      else merged.set(i.productId, { productId: i.productId, name: i.name, qty: i.qty, pricePaise: i.pricePaise, costPaise: i.costPaise });
    }
  const hit = reconcileBasket([...merged.values()], amountPaise, tolerancePct);
  if (!hit) return { lines: [], confidence: "probable", matchedBasket: false, eventIds: [], summary: [] };
  return {
    lines: hit.lines.map((l) => ({ productId: l.productId, qty: l.qty, pricePaise: l.pricePaise, costPaise: merged.get(l.productId)!.costPaise })),
    confidence: hit.errorFrac <= 0.005 ? "confirmed" : "probable",
    matchedBasket: true,
    eventIds: baskets.map((b) => b.id),
    summary: hit.lines.map((l) => `${l.name} × ${l.qty}`),
  };
}

/* ---------------- DB wiring ---------------- */

export interface HeardResult {
  intent: SoundboxParseT["intent"];
  understood: { name: string; qty: number }[];
  unmatched: string[];
  lostDemand: number;
}

/** Customer speech (already text) → event row + lost demand. `parsed` null = parser refused/failed. */
export async function heard(db: Db, merchantId: string, text: string, parsed: SoundboxParseT | null, now = new Date()): Promise<HeardResult> {
  const snap = await loadSnapshot(db, merchantId, { now, historyDays: 1 });
  const p: SoundboxParseT = parsed ?? { intent: "other", items: [], asked_availability: false };
  const plan = planUtterance(snap.products, p, snap.settings.ingest.matchMaxScore);
  // Privacy: personal talk is discarded immediately. Nothing is stored, no lost demand is logged.
  if (p.intent === "other") return { intent: "other", understood: [], unmatched: [], lostDemand: 0 };
  await saveSoundboxEvent(db, { merchantId, intent: p.intent, transcript: text, parsed: { matched: plan.matched, unmatched: plan.unmatched, askedAvailability: p.asked_availability } });
  for (const l of plan.lost) await recordLostDemand(db, { merchantId, productId: l.productId, qty: l.qty, rawText: text, estValuePaise: l.estValuePaise });
  return { intent: p.intent, understood: plan.matched.map((m) => ({ name: m.name, qty: m.qty })), unmatched: plan.unmatched, lostDemand: plan.lost.length };
}

export interface PaidResult extends PaymentPlan {
  transactionId: string;
}

/** A UPI payment landed. Reconcile with baskets held inside the hold window, then save. */
export async function paid(db: Db, merchantId: string, amountPaise: number, now = new Date()): Promise<PaidResult> {
  const snap: Pick<Snapshot, "settings"> = { settings: (await loadSnapshot(db, merchantId, { now, historyDays: 1 })).settings };
  const cfg = snap.settings.ingest;
  const rows = await openSoundboxBaskets(db, merchantId, cfg.basketHoldMinutes, now);
  const baskets: HeldBasket[] = rows.map((r) => ({ id: r.id, items: ((r.parsed as { matched?: HeardItem[] } | null)?.matched ?? []) as HeardItem[] }));
  const plan = planPayment(baskets, amountPaise, cfg.basketTolerancePct);
  const { transactionId } = await recordSoundboxSale(db, { merchantId, amountPaise, lines: plan.lines, confidence: plan.confidence, eventIds: plan.matchedBasket ? plan.eventIds : [] });
  return { ...plan, transactionId };
}
