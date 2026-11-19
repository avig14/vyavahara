/** Thin helpers for route handlers: one place for DB/merchant lookup and uniform JSON errors. */
import { flushWrites, getDb, isQuotaError, type Db } from "../db/client";
import { getDefaultMerchantId } from "../db/queries";

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface Ctx {
  db: Db;
  merchantId: string;
  now: Date;
}

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

/** Demo is single-merchant. Real auth would resolve the merchant from a session here. */
export async function getCtx(): Promise<Ctx> {
  if (!process.env.DATABASE_URL) throw new HttpError(503, "DATABASE_URL is not set");
  const db = getDb();
  const merchantId = await getDefaultMerchantId(db);
  if (!merchantId) throw new HttpError(404, "No merchant yet. Run `npm run seed`.");
  return { db, merchantId, now: new Date() };
}

/** Wrap a handler: HttpError → its status, anything else → 500 without leaking internals. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (isQuotaError(e)) {
      console.error("[api] Neon plan limit reached");
      return json({ error: "Database limit reached for this month. Try again later or upgrade the Neon plan." }, 503);
    }
    console.error("[api]", e);
    return json({ error: "Something went wrong" }, 500);
  } finally {
    // One tiny update per request that wrote anything, so other server instances drop their cached snapshot.
    await flushWrites();
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
}
