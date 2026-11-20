import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { mayChangeSnapshot, snapshotCache } from "./snapshot-cache";

export type Db = NeonHttpDatabase<typeof schema>;

type Sql = NeonQueryFunction<false, false>;

let _db: Db | null = null;
let _raw: Sql | null = null;

/**
 * Drizzle's neon-http driver runs every statement through `sql.query(text, params, opts)` and every
 * `db.batch` through `sql.transaction(queries)`. Wrapping those two methods is the one place that sees
 * every write, so the snapshot cache can never miss one (see snapshot-cache.ts). Reads pass through untouched.
 */
function watchWrites(sql: Sql): Sql {
  const query = sql.query.bind(sql) as (...a: unknown[]) => unknown;
  const transaction = sql.transaction.bind(sql) as (...a: unknown[]) => unknown;
  const patched = sql as unknown as { query: unknown; transaction: unknown };
  patched.query = (text: unknown, ...rest: unknown[]) => {
    if (mayChangeSnapshot(text)) snapshotCache.noteWrite();
    return query(text, ...rest);
  };
  patched.transaction = (...a: unknown[]) => {
    snapshotCache.noteWrite();
    return transaction(...a);
  };
  return sql;
}

/**
 * Lazy so `next build` works without DATABASE_URL.
 * Neon HTTP has no interactive transactions: use db.batch([...]) for atomic multi-writes.
 */
export function getDb(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _raw = neon(url);
  _db = drizzle({ client: watchWrites(neon(url)), schema });
  return _db;
}

/**
 * Tell other server instances that data changed, once per request that wrote (not once per statement).
 * Call it when a request or background task that may have written is finished. It never throws: if it
 * fails, the 10-minute TTL in snapshot-cache.ts is the safety net. Uses an unwatched connection so the
 * bump is not itself counted as a write.
 */
export async function flushWrites(): Promise<void> {
  if (!snapshotCache.dirty || !_raw) return;
  const mark = snapshotCache.beginFlush();
  try {
    await _raw.query("update merchants set data_version = data_version + 1");
    snapshotCache.endFlush(mark);
  } catch (e) {
    console.error("[db] version bump failed", e instanceof Error ? e.message : "unknown");
  }
}

/** True when Neon refused because the project used up its plan (HTTP 402 "exceeded the quota"). */
export function isQuotaError(e: unknown, depth = 0): boolean {
  if (!e || depth > 4) return false;
  const msg = e instanceof Error ? e.message : String(e);
  if (/HTTP status 402|exceeded the quota/i.test(msg)) return true;
  return isQuotaError((e as { cause?: unknown }).cause, depth + 1);
}

export { schema };
