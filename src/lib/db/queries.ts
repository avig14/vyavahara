/**
 * DB ↔ Snapshot bridge. `loadSnapshot` feeds every pure analytics function; the write helpers are the only
 * ways the app changes merchant data. Neon HTTP: no interactive txns → multi-writes use db.batch (atomic).
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "./client";
import { schema as s } from "./client";
import type { Snapshot } from "../domain";
import { applySettingsPatch, resolveSettings, type MerchantSettings } from "../settings";

/* ---------------- read ---------------- */

/** Demo is single-merchant: the first (oldest) merchant row. */
export async function getDefaultMerchantId(db: Db): Promise<string | null> {
  const [row] = await db.select({ id: s.merchants.id }).from(s.merchants).orderBy(s.merchants.createdAt).limit(1);
  return row?.id ?? null;
}

export async function getMerchantByPhone(db: Db, phone: string) {
  const [row] = await db.select().from(s.merchants).where(eq(s.merchants.ownerPhoneWa, phone)).limit(1);
  return row ?? null;
}

export async function loadSettings(db: Db, merchantId: string): Promise<MerchantSettings> {
  const [row] = await db.select({ settings: s.merchants.settings }).from(s.merchants).where(eq(s.merchants.id, merchantId));
  if (!row) throw new Error("merchant not found");
  return resolveSettings(row.settings);
}

/** Load everything the analytics need for one merchant. `historyDays` bounds the big tables. */
export async function loadSnapshot(db: Db, merchantId: string, opts: { now?: Date; historyDays?: number } = {}): Promise<Snapshot> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.historyDays ?? 200) * 86_400_000);
  const mine = <T extends { merchantId: unknown }>(t: T) => eq(t.merchantId as never, merchantId);

  const [merchant] = await db.select().from(s.merchants).where(eq(s.merchants.id, merchantId));
  if (!merchant) throw new Error("merchant not found");

  const [products, vendors, purchases, vendorPayments, customers, transactions, saleItems, khata, expenses, lostDemand, festivals] =
    await Promise.all([
      db.select().from(s.products).where(mine(s.products)),
      db.select().from(s.vendors).where(mine(s.vendors)),
      db.select().from(s.purchases).where(mine(s.purchases)),
      db.select().from(s.vendorPayments).where(mine(s.vendorPayments)),
      db.select().from(s.customers).where(mine(s.customers)),
      db.select().from(s.transactions).where(and(mine(s.transactions), gte(s.transactions.createdAt, since))),
      db.select().from(s.saleItems).where(and(mine(s.saleItems), gte(s.saleItems.createdAt, since))),
      db.select().from(s.khataEntries).where(mine(s.khataEntries)),
      db.select().from(s.expenses).where(mine(s.expenses)),
      db.select().from(s.lostDemand).where(and(mine(s.lostDemand), gte(s.lostDemand.createdAt, since))),
      db.select().from(s.festivals),
    ]);

  const vendorIds = vendors.map((v) => v.id);
  const purchaseIds = purchases.map((p) => p.id);
  const [vendorProducts, purchaseItems] = await Promise.all([
    vendorIds.length ? db.select().from(s.vendorProducts).where(inArray(s.vendorProducts.vendorId, vendorIds)) : Promise.resolve([]),
    purchaseIds.length ? db.select().from(s.purchaseItems).where(inArray(s.purchaseItems.purchaseId, purchaseIds)) : Promise.resolve([]),
  ]);

  return {
    now,
    merchant: {
      id: merchant.id,
      name: merchant.name,
      ownerName: merchant.ownerName,
      ownerPhoneWa: merchant.ownerPhoneWa,
      waConnectedAt: merchant.waConnectedAt,
      waLastInboundAt: merchant.waLastInboundAt,
      upiId: merchant.upiId,
      gstScheme: merchant.gstScheme,
      city: merchant.city,
    },
    settings: resolveSettings(merchant.settings),
    products,
    vendors,
    vendorProducts,
    purchases,
    purchaseItems,
    vendorPayments,
    customers,
    transactions,
    saleItems,
    khata,
    expenses,
    lostDemand,
    festivals,
  };
}

/* ---------------- settings ---------------- */

export type SaveSettingsResult = { ok: true; settings: MerchantSettings } | { ok: false; error: string };

/** Validate + deep-merge a partial patch into the stored settings, then persist. */
export async function saveSettings(db: Db, merchantId: string, patch: unknown): Promise<SaveSettingsResult> {
  const current = await loadSettings(db, merchantId);
  const r = applySettingsPatch(current, patch);
  if (!r.ok) return r;
  await db.batch([
    db.update(s.merchants).set({ settings: r.settings }).where(eq(s.merchants.id, merchantId)),
    db.insert(s.auditLog).values({ merchantId, actor: "owner", action: "settings.update", payload: { patch } }),
  ]);
  return r;
}

export async function resetSettings(db: Db, merchantId: string): Promise<MerchantSettings> {
  const settings = resolveSettings({});
  await db.batch([
    db.update(s.merchants).set({ settings }).where(eq(s.merchants.id, merchantId)),
    db.insert(s.auditLog).values({ merchantId, actor: "owner", action: "settings.reset" }),
  ]);
  return settings;
}

/* ---------------- writes ---------------- */

type Actor = "ai" | "owner" | "system";
const audit = (db: Db, merchantId: string, actor: Actor, action: string, payload?: unknown) =>
  db.insert(s.auditLog).values({ merchantId, actor, action, payload: payload ?? null });

export async function addAudit(db: Db, merchantId: string, actor: Actor, action: string, payload?: unknown) {
  await audit(db, merchantId, actor, action, payload);
}

export async function addKhataEntry(
  db: Db,
  a: { merchantId: string; customerId: string; type: "credit" | "payment"; amountPaise: number; note?: string; source?: string; actor?: Actor },
) {
  if (!Number.isInteger(a.amountPaise) || a.amountPaise <= 0) throw new Error("amount must be positive integer paise");
  const [row] = await db.batch([
    db
      .insert(s.khataEntries)
      .values({ merchantId: a.merchantId, customerId: a.customerId, type: a.type, amountPaise: a.amountPaise, note: a.note ?? null, source: a.source ?? "owner" })
      .returning(),
    audit(db, a.merchantId, a.actor ?? "owner", `khata.${a.type}`, { customerId: a.customerId, amountPaise: a.amountPaise }),
  ]);
  return row[0];
}

export async function addExpense(
  db: Db,
  a: { merchantId: string; category: "rent" | "electricity" | "salary" | "transport" | "other"; amountPaise: number; note?: string; actor?: Actor },
) {
  if (!Number.isInteger(a.amountPaise) || a.amountPaise <= 0) throw new Error("amount must be positive integer paise");
  const [row] = await db.batch([
    db.insert(s.expenses).values({ merchantId: a.merchantId, category: a.category, amountPaise: a.amountPaise, note: a.note ?? null }).returning(),
    audit(db, a.merchantId, a.actor ?? "owner", "expense.add", { category: a.category, amountPaise: a.amountPaise }),
  ]);
  return row[0];
}

/** Change stock by `delta` and log a movement, atomically. */
export async function adjustStock(
  db: Db,
  a: { merchantId: string; productId: string; delta: number; reason: "sale" | "purchase" | "adjust"; refId?: string; actor?: Actor },
) {
  await db.batch([
    db
      .update(s.products)
      .set({ stockQty: sql`${s.products.stockQty} + ${a.delta}` })
      .where(and(eq(s.products.id, a.productId), eq(s.products.merchantId, a.merchantId))),
    db.insert(s.stockMovements).values({ merchantId: a.merchantId, productId: a.productId, delta: a.delta, reason: a.reason, refId: a.refId ?? null }),
    audit(db, a.merchantId, a.actor ?? "owner", "stock.adjust", { productId: a.productId, delta: a.delta, reason: a.reason }),
  ]);
}

export async function setCreditBlocked(db: Db, merchantId: string, customerId: string, blocked: boolean, actor: Actor = "owner") {
  await db.batch([
    db.update(s.customers).set({ creditBlocked: blocked }).where(and(eq(s.customers.id, customerId), eq(s.customers.merchantId, merchantId))),
    audit(db, merchantId, actor, blocked ? "khata.block_credit" : "khata.unblock_credit", { customerId }),
  ]);
}

export async function setCreditLimit(db: Db, merchantId: string, customerId: string, limitPaise: number, actor: Actor = "owner") {
  if (!Number.isInteger(limitPaise) || limitPaise < 0) throw new Error("limit must be integer paise ≥ 0");
  await db.batch([
    db.update(s.customers).set({ creditLimitPaise: limitPaise }).where(and(eq(s.customers.id, customerId), eq(s.customers.merchantId, merchantId))),
    audit(db, merchantId, actor, "khata.set_limit", { customerId, limitPaise }),
  ]);
}

export async function createPurchaseOrder(
  db: Db,
  a: { merchantId: string; vendorId: string; items: { productId: string; name: string; qty: number; unit: string }[]; actor?: Actor },
) {
  const [row] = await db.batch([
    db.insert(s.purchaseOrders).values({ merchantId: a.merchantId, vendorId: a.vendorId, items: a.items }).returning(),
    audit(db, a.merchantId, a.actor ?? "ai", "po.draft", { vendorId: a.vendorId, lines: a.items.length }),
  ]);
  return row[0];
}

export async function recordLostDemand(
  db: Db,
  a: { merchantId: string; productId: string; qty: number; rawText?: string; estValuePaise: number },
) {
  await db.insert(s.lostDemand).values({ merchantId: a.merchantId, productId: a.productId, qty: a.qty, rawText: a.rawText ?? null, estValuePaise: a.estValuePaise });
}

/** Pay a vendor bill: log payment and flip the purchase status in one batch. */
export async function payVendorBill(db: Db, a: { merchantId: string; purchaseId: string; amountPaise?: number; actor?: Actor }) {
  const [p] = await db.select().from(s.purchases).where(and(eq(s.purchases.id, a.purchaseId), eq(s.purchases.merchantId, a.merchantId)));
  if (!p) throw new Error("bill not found");
  const amount = a.amountPaise ?? p.totalPaise;
  const status = amount >= p.totalPaise ? "paid" : "partial";
  await db.batch([
    db.insert(s.vendorPayments).values({ merchantId: a.merchantId, vendorId: p.vendorId, amountPaise: amount }),
    db.update(s.purchases).set({ status }).where(eq(s.purchases.id, p.id)),
    audit(db, a.merchantId, a.actor ?? "owner", "vendor.pay", { purchaseId: p.id, amountPaise: amount }),
  ]);
  return { purchaseId: p.id, status, amountPaise: amount };
}

export async function recentConversation(db: Db, merchantId: string, channel: "wa" | "web", limit = 12) {
  const rows = await db
    .select()
    .from(s.conversations)
    .where(and(eq(s.conversations.merchantId, merchantId), eq(s.conversations.channel, channel)))
    .orderBy(desc(s.conversations.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function saveConversationTurn(
  db: Db,
  merchantId: string,
  channel: "wa" | "web",
  turn: { role: "user" | "assistant"; content: string }[],
) {
  if (!turn.length) return;
  await db.insert(s.conversations).values(turn.map((t) => ({ merchantId, channel, role: t.role, content: t.content })));
}

/* ---------------- manual cash sale ---------------- */

export async function addCashSale(db: Db, a: { merchantId: string; amountPaise: number; actor?: Actor }) {
  if (!Number.isInteger(a.amountPaise) || a.amountPaise <= 0) throw new Error("amount must be positive integer paise");
  const [row] = await db.batch([
    db.insert(s.transactions).values({ merchantId: a.merchantId, amountPaise: a.amountPaise, method: "cash", kind: "sale", source: "manual" }).returning(),
    audit(db, a.merchantId, a.actor ?? "owner", "sale.cash", { amountPaise: a.amountPaise }),
  ]);
  return row[0];
}

/* ---------------- pending actions (1 = confirm / 2 = cancel) ---------------- */

export type PendingKind = "block_credit" | "set_limit" | "adjust_stock" | "udhaar" | "stock_in" | "pay_vendor" | "create_po";

export async function createPendingAction(db: Db, merchantId: string, kind: PendingKind, payload: unknown, ttlMinutes = 30, now = new Date()) {
  // a new question replaces any older open one, so "1" always means the latest
  await db
    .update(s.pendingActions)
    .set({ status: "cancelled" })
    .where(and(eq(s.pendingActions.merchantId, merchantId), eq(s.pendingActions.status, "open")));
  const [row] = await db
    .insert(s.pendingActions)
    .values({ merchantId, kind, payload, expiresAt: new Date(now.getTime() + ttlMinutes * 60_000) })
    .returning();
  return row;
}

/** Latest open, unexpired action. Stale ones are marked expired. */
export async function getOpenPending(db: Db, merchantId: string, now = new Date()) {
  await db
    .update(s.pendingActions)
    .set({ status: "expired" })
    .where(and(eq(s.pendingActions.merchantId, merchantId), eq(s.pendingActions.status, "open"), sql`${s.pendingActions.expiresAt} < ${now.toISOString()}`));
  const [row] = await db
    .select()
    .from(s.pendingActions)
    .where(and(eq(s.pendingActions.merchantId, merchantId), eq(s.pendingActions.status, "open")))
    .orderBy(desc(s.pendingActions.createdAt))
    .limit(1);
  return row ?? null;
}

/** Atomically move an open action to a final status. Returns false if someone else already did (double click, 2 channels). */
export async function resolvePending(db: Db, merchantId: string, id: string, status: "confirmed" | "cancelled" | "open") {
  const rows = await db
    .update(s.pendingActions)
    .set({ status })
    .where(and(eq(s.pendingActions.id, id), eq(s.pendingActions.merchantId, merchantId), eq(s.pendingActions.status, status === "open" ? "confirmed" : "open")))
    .returning({ id: s.pendingActions.id });
  return rows.length > 0;
}

/* ---------------- supplier bill received (photo → owner confirmed) ---------------- */

export interface BillReceipt {
  vendorId: string;
  invoiceNo: string | null;
  /** YYYY-MM-DD */
  invoiceDate: string;
  dueDate: string;
  totalPaise: number;
  items: { productId: string; qty: number; unitCostPaise: number; gstRate?: number }[];
}

/** One atomic batch: purchase + lines, stock up, movements, vendor price history, product cost. */
export async function receiveBill(db: Db, merchantId: string, b: BillReceipt, source: "photo" | "manual" = "photo", actor: Actor = "owner") {
  if (!b.items.length) throw new Error("bill has no items");
  const purchaseId = crypto.randomUUID();
  const q: unknown[] = [
    db.insert(s.purchases).values({ id: purchaseId, merchantId, vendorId: b.vendorId, invoiceNo: b.invoiceNo, invoiceDate: b.invoiceDate, totalPaise: b.totalPaise, dueDate: b.dueDate, source }),
    db.insert(s.purchaseItems).values(b.items.map((i) => ({ purchaseId, productId: i.productId, qty: i.qty, unitCostPaise: i.unitCostPaise, gstRate: i.gstRate ?? 0 }))),
  ];
  for (const i of b.items) {
    q.push(
      db
        .update(s.products)
        .set({ stockQty: sql`${s.products.stockQty} + ${i.qty}`, costPaise: i.unitCostPaise })
        .where(and(eq(s.products.id, i.productId), eq(s.products.merchantId, merchantId))),
      db.insert(s.stockMovements).values({ merchantId, productId: i.productId, delta: i.qty, reason: "purchase", refId: purchaseId }),
      db
        .insert(s.vendorProducts)
        .values({ vendorId: b.vendorId, productId: i.productId, lastCostPaise: i.unitCostPaise, prevCostPaise: null })
        .onConflictDoUpdate({
          target: [s.vendorProducts.vendorId, s.vendorProducts.productId],
          set: { prevCostPaise: sql`${s.vendorProducts.lastCostPaise}`, lastCostPaise: i.unitCostPaise, updatedAt: new Date() },
        }),
    );
  }
  q.push(audit(db, merchantId, actor, "purchase.receive", { purchaseId, vendorId: b.vendorId, lines: b.items.length, totalPaise: b.totalPaise }));
  await db.batch(q as unknown as Parameters<Db["batch"]>[0]);
  return { purchaseId };
}

/* ---------------- artifacts (PDF / pay links) ---------------- */

export async function createArtifact(db: Db, merchantId: string, kind: "report_pdf" | "pay_link", params: unknown, ttlMs = 7 * 86_400_000, now = new Date()) {
  const token = randomBytes(24).toString("base64url");
  await db.insert(s.artifacts).values({ merchantId, kind, token, params, expiresAt: new Date(now.getTime() + ttlMs) });
  return token;
}

/** Row only if it exists, matches `kind` and has not expired. */
export async function getArtifact(db: Db, token: string, kind: "report_pdf" | "pay_link", now = new Date()) {
  const [row] = await db.select().from(s.artifacts).where(and(eq(s.artifacts.token, token), eq(s.artifacts.kind, kind))).limit(1);
  if (!row || row.expiresAt < now) return null;
  return row;
}

export async function setArtifactParams(db: Db, id: string, params: unknown) {
  await db.update(s.artifacts).set({ params }).where(eq(s.artifacts.id, id));
}

/* ---------------- misc reads for the dashboard ---------------- */

export async function getPendingById(db: Db, merchantId: string, id: string) {
  const [row] = await db.select().from(s.pendingActions).where(and(eq(s.pendingActions.id, id), eq(s.pendingActions.merchantId, merchantId))).limit(1);
  return row ?? null;
}

export async function listPurchaseOrders(db: Db, merchantId: string, limit = 20) {
  return db.select().from(s.purchaseOrders).where(eq(s.purchaseOrders.merchantId, merchantId)).orderBy(desc(s.purchaseOrders.createdAt)).limit(limit);
}

export async function listKhataLedger(db: Db, merchantId: string, customerId: string, limit = 100) {
  return db
    .select()
    .from(s.khataEntries)
    .where(and(eq(s.khataEntries.merchantId, merchantId), eq(s.khataEntries.customerId, customerId)))
    .orderBy(desc(s.khataEntries.createdAt))
    .limit(limit);
}

/* ---------------- soundbox ---------------- */

export async function saveSoundboxEvent(db: Db, a: { merchantId: string; intent: string; parsed: unknown; transcript?: string | null }) {
  const [row] = await db.insert(s.soundboxEvents).values({ merchantId: a.merchantId, intent: a.intent, parsed: a.parsed, transcript: a.transcript ?? null }).returning();
  return row;
}

/** Heard-but-unpaid purchase baskets still inside the hold window (settings.ingest.basketHoldMinutes). Newest first. */
export async function openSoundboxBaskets(db: Db, merchantId: string, holdMinutes: number, now = new Date()) {
  const since = new Date(now.getTime() - holdMinutes * 60_000);
  return db
    .select()
    .from(s.soundboxEvents)
    .where(and(eq(s.soundboxEvents.merchantId, merchantId), eq(s.soundboxEvents.intent, "purchase"), sql`${s.soundboxEvents.reconciledTxnId} is null`, gte(s.soundboxEvents.createdAt, since)))
    .orderBy(desc(s.soundboxEvents.createdAt));
}

/** Payment arrived: save the UPI transaction, item-level sale + stock decrement for matched lines, close the baskets. One batch. */
export async function recordSoundboxSale(
  db: Db,
  a: {
    merchantId: string;
    amountPaise: number;
    lines: { productId: string; qty: number; pricePaise: number; costPaise: number }[];
    confidence: "confirmed" | "probable";
    eventIds: string[];
  },
) {
  if (!Number.isInteger(a.amountPaise) || a.amountPaise <= 0) throw new Error("amount must be positive integer paise");
  const txnId = crypto.randomUUID();
  const q: unknown[] = [
    db.insert(s.transactions).values({ id: txnId, merchantId: a.merchantId, amountPaise: a.amountPaise, method: "upi", kind: "sale", source: "soundbox", utr: `SB${Date.now()}` }),
  ];
  if (a.lines.length) {
    q.push(db.insert(s.saleItems).values(a.lines.map((l) => ({ merchantId: a.merchantId, transactionId: txnId, productId: l.productId, qty: l.qty, unitPricePaise: l.pricePaise, unitCostPaise: l.costPaise, confidence: a.confidence }))));
    for (const l of a.lines) {
      q.push(
        db.update(s.products).set({ stockQty: sql`${s.products.stockQty} - ${l.qty}` }).where(and(eq(s.products.id, l.productId), eq(s.products.merchantId, a.merchantId))),
        db.insert(s.stockMovements).values({ merchantId: a.merchantId, productId: l.productId, delta: -l.qty, reason: "sale", refId: txnId }),
      );
    }
  }
  if (a.eventIds.length) q.push(db.update(s.soundboxEvents).set({ reconciledTxnId: txnId }).where(inArray(s.soundboxEvents.id, a.eventIds)));
  await db.batch(q as unknown as Parameters<Db["batch"]>[0]);
  return { transactionId: txnId };
}
