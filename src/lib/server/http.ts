/** Thin helpers for route handlers: one place for DB/merchant lookup and uniform JSON errors. */
import { getDb, type Db } from "../db/client";
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
    // Neon free plan out of compute: say so plainly instead of a generic 500
    if (/exceeded the quota/i.test(`${(e as { cause?: unknown })?.cause ?? ""} ${e instanceof Error ? e.message : ""}`))
      return json({ error: "Database limit khatam ho gaya (Neon free plan quota). Database plan badhaiye ya naya database lagaiye." }, 503);
    console.error("[api]", e);
    return json({ error: "Something went wrong" }, 500);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
}
