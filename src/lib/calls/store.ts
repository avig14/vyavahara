/** DB access for Call Saathi (call_attempts). */
import { and, desc, eq, gte } from "drizzle-orm";
import type { Db } from "../db/client";
import { schema as s } from "../db/client";
import type { PastAttempt } from "./select";

export async function recentAttempts(db: Db, merchantId: string, sinceDays = 90, now = new Date()): Promise<PastAttempt[]> {
  const since = new Date(now.getTime() - sinceDays * 86_400_000);
  const rows = await db
    .select({ customerId: s.callAttempts.customerId, createdAt: s.callAttempts.createdAt, outcome: s.callAttempts.outcome })
    .from(s.callAttempts)
    .where(and(eq(s.callAttempts.merchantId, merchantId), gte(s.callAttempts.createdAt, since)))
    .orderBy(desc(s.callAttempts.createdAt));
  return rows;
}

export async function createAttempt(db: Db, a: { merchantId: string; customerId: string; amountPaise: number; overdueDays: number }) {
  const [row] = await db.insert(s.callAttempts).values({ ...a, status: "queued" }).returning({ id: s.callAttempts.id });
  return row.id;
}

export async function getAttempt(db: Db, id: string) {
  const [row] = await db.select().from(s.callAttempts).where(eq(s.callAttempts.id, id)).limit(1);
  return row ?? null;
}

export async function updateAttempt(
  db: Db,
  id: string,
  patch: Partial<{ status: "queued" | "dialing" | "completed" | "failed"; outcome: "will_pay" | "call_back" | "no_response" | "no_answer" | "error"; callUuid: string; detail: string; durationSec: number }>,
) {
  await db.update(s.callAttempts).set({ ...patch, updatedAt: new Date() }).where(eq(s.callAttempts.id, id));
}

export async function getCustomerName(db: Db, id: string): Promise<string | null> {
  const [row] = await db.select({ name: s.customers.name }).from(s.customers).where(eq(s.customers.id, id)).limit(1);
  return row?.name ?? null;
}

export async function getMerchantName(db: Db, id: string): Promise<string | null> {
  const [row] = await db.select({ name: s.merchants.name }).from(s.merchants).where(eq(s.merchants.id, id)).limit(1);
  return row?.name ?? null;
}

export async function listAttempts(db: Db, merchantId: string, limit = 50) {
  return db.select().from(s.callAttempts).where(eq(s.callAttempts.merchantId, merchantId)).orderBy(desc(s.callAttempts.createdAt)).limit(limit);
}

export async function setCustomerContact(db: Db, merchantId: string, customerId: string, patch: { phone?: string | null; callConsent?: boolean }) {
  await db
    .update(s.customers)
    .set(patch)
    .where(and(eq(s.customers.id, customerId), eq(s.customers.merchantId, merchantId)));
}
