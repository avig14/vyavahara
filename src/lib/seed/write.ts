import type { Db } from "../db/client";
import { schema as s } from "../db/client";
import type { Snapshot } from "../domain";

const CHUNK = 1000;

function chunks<T>(rows: T[], n = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += n) out.push(rows.slice(i, i + n));
  return out;
}

/** Wipe every table (demo DB only) and write the snapshot. Neon HTTP: no txns, so wipe → insert in chunks. */
export async function writeSnapshot(db: Db, snap: Snapshot): Promise<Record<string, number>> {
  const mid = snap.merchant.id;

  for (const t of [
    s.auditLog, s.conversations, s.pendingActions, s.waSessions, s.artifacts, s.recommendationsLog, s.alerts,
    s.festivals, s.soundboxEvents, s.lostDemand, s.expenses, s.khataEntries, s.stockMovements, s.saleItems,
    s.transactions, s.customers, s.purchaseOrders, s.vendorPayments, s.purchaseItems, s.purchases,
    s.vendorProducts, s.vendors, s.products, s.merchants,
  ])
    await db.delete(t);

  const m = snap.merchant;
  await db.insert(s.merchants).values({
    id: m.id,
    name: m.name,
    ownerName: m.ownerName,
    ownerPhoneWa: m.ownerPhoneWa,
    waConnectedAt: m.waConnectedAt,
    waLastInboundAt: m.waLastInboundAt,
    upiId: m.upiId,
    gstScheme: m.gstScheme,
    city: m.city,
    settings: snap.settings,
  });

  await db.insert(s.products).values(snap.products.map((p) => ({ ...p, merchantId: mid })));
  await db.insert(s.vendors).values(snap.vendors.map((v) => ({ ...v, merchantId: mid })));
  await db.insert(s.vendorProducts).values(snap.vendorProducts);
  await db.insert(s.customers).values(snap.customers.map((c) => ({ ...c, merchantId: mid })));
  await db.insert(s.festivals).values(snap.festivals);

  for (const c of chunks(snap.purchases)) await db.insert(s.purchases).values(c.map((p) => ({ ...p, merchantId: mid })));
  for (const c of chunks(snap.purchaseItems)) await db.insert(s.purchaseItems).values(c);
  for (const c of chunks(snap.vendorPayments))
    await db.insert(s.vendorPayments).values(c.map((p) => ({ ...p, merchantId: mid })));
  for (const c of chunks(snap.transactions))
    await db.insert(s.transactions).values(c.map((t) => ({ ...t, merchantId: mid })));
  for (const c of chunks(snap.saleItems)) await db.insert(s.saleItems).values(c.map((i) => ({ ...i, merchantId: mid })));
  for (const c of chunks(snap.khata)) await db.insert(s.khataEntries).values(c.map((k) => ({ ...k, merchantId: mid })));
  for (const c of chunks(snap.expenses)) await db.insert(s.expenses).values(c.map((e) => ({ ...e, merchantId: mid })));
  for (const c of chunks(snap.lostDemand)) await db.insert(s.lostDemand).values(c.map((l) => ({ ...l, merchantId: mid })));

  return {
    products: snap.products.length,
    vendors: snap.vendors.length,
    customers: snap.customers.length,
    transactions: snap.transactions.length,
    saleItems: snap.saleItems.length,
    purchases: snap.purchases.length,
    khata: snap.khata.length,
    expenses: snap.expenses.length,
    lostDemand: snap.lostDemand.length,
  };
}
