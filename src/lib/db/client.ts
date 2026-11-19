import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

let _db: Db | null = null;

/**
 * Lazy so `next build` works without DATABASE_URL.
 * Neon HTTP has no interactive transactions: use db.batch([...]) for atomic multi-writes.
 */
export function getDb(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _db = drizzle({ client: neon(url), schema });
  return _db;
}

export { schema };
