import { describe, expect, it } from "vitest";
import { SnapshotCache, mayChangeSnapshot } from "./snapshot-cache";

/** A fake database: a version number and a counter of how many full loads happened. */
function rig(ttl = 600_000) {
  let now = 1_000_000;
  const db = { version: 1, loads: 0, probes: 0, failProbe: false };
  const cache = new SnapshotCache(ttl, () => now);
  const probe = async () => {
    db.probes++;
    if (db.failProbe) throw new Error("probe down");
    return db.version;
  };
  const load = async () => ({ n: ++db.loads });
  return { db, cache, probe, load, tick: (ms: number) => (now += ms) };
}

describe("SnapshotCache", () => {
  it("serves the cached copy when nothing changed (one load, many reads)", async () => {
    const r = rig();
    const a = await r.cache.get("m", r.probe, r.load);
    const b = await r.cache.get("m", r.probe, r.load);
    const c = await r.cache.get("m", r.probe, r.load);
    expect(r.db.loads).toBe(1);
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(r.db.probes).toBe(3);
  });

  it("reloads when another instance bumped the database version", async () => {
    const r = rig();
    await r.cache.get("m", r.probe, r.load);
    r.db.version = 2;
    const b = await r.cache.get("m", r.probe, r.load);
    expect(b.n).toBe(2);
    expect(r.db.loads).toBe(2);
  });

  it("reloads right after a local write, before any version bump", async () => {
    const r = rig();
    await r.cache.get("m", r.probe, r.load);
    r.cache.noteWrite();
    await r.cache.get("m", r.probe, r.load);
    expect(r.db.loads).toBe(2);
  });

  it("does not store a load that raced with a write", async () => {
    const r = rig();
    let release: () => void = () => {};
    const slow = async () => {
      const n = ++r.db.loads;
      await new Promise<void>((res) => (release = res));
      return { n };
    };
    const first = r.cache.get("m", r.probe, slow);
    await Promise.resolve();
    await Promise.resolve();
    r.cache.noteWrite(); // write lands while the load is in flight
    release();
    await first;
    const second = await r.cache.get("m", r.probe, r.load);
    expect(second.n).toBe(2); // the raced result was not trusted
  });

  it("expires after the TTL", async () => {
    const r = rig(1000);
    await r.cache.get("m", r.probe, r.load);
    r.tick(999);
    await r.cache.get("m", r.probe, r.load);
    expect(r.db.loads).toBe(1);
    r.tick(2);
    await r.cache.get("m", r.probe, r.load);
    expect(r.db.loads).toBe(2);
  });

  it("shares one load between concurrent callers", async () => {
    const r = rig();
    const [a, b, c] = await Promise.all([r.cache.get("m", r.probe, r.load), r.cache.get("m", r.probe, r.load), r.cache.get("m", r.probe, r.load)]);
    expect(r.db.loads).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("falls back to a plain load when the version probe fails, and does not cache it", async () => {
    const r = rig();
    r.db.failProbe = true;
    await r.cache.get("m", r.probe, r.load);
    await r.cache.get("m", r.probe, r.load);
    expect(r.db.loads).toBe(2);
  });

  it("a failed load is not cached and the next call retries", async () => {
    const r = rig();
    await expect(r.cache.get("m", r.probe, async () => Promise.reject(new Error("402")))).rejects.toThrow("402");
    const ok = await r.cache.get("m", r.probe, r.load);
    expect(ok.n).toBe(1);
  });

  it("keeps merchants apart", async () => {
    const r = rig();
    const a = await r.cache.get("a", r.probe, r.load);
    const b = await r.cache.get("b", r.probe, r.load);
    expect(a).not.toBe(b);
    expect(r.db.loads).toBe(2);
  });

  it("flush bookkeeping: dirty after a write, clean once the bump is confirmed", () => {
    const r = rig();
    expect(r.cache.dirty).toBe(false);
    r.cache.noteWrite();
    r.cache.noteWrite();
    expect(r.cache.dirty).toBe(true);
    const mark = r.cache.beginFlush();
    r.cache.noteWrite(); // a write that lands during the flush must stay dirty
    r.cache.endFlush(mark);
    expect(r.cache.dirty).toBe(true);
    r.cache.endFlush(r.cache.beginFlush());
    expect(r.cache.dirty).toBe(false);
  });

  it("a failed flush leaves the cache dirty so the next request retries", () => {
    const r = rig();
    r.cache.noteWrite();
    r.cache.beginFlush(); // bump failed: endFlush never called
    expect(r.cache.dirty).toBe(true);
  });
});

describe("mayChangeSnapshot", () => {
  it("reads never count", () => {
    expect(mayChangeSnapshot('select "id" from "merchants" where "id" = $1')).toBe(false);
    expect(mayChangeSnapshot("  SELECT 1")).toBe(false);
  });

  it("writes to snapshot tables count", () => {
    expect(mayChangeSnapshot('insert into "transactions" ("id") values ($1)')).toBe(true);
    expect(mayChangeSnapshot('update "products" set "stock_qty" = $1 where "id" = $2')).toBe(true);
    expect(mayChangeSnapshot('delete from "khata_entries" where "id" = $1')).toBe(true);
    expect(mayChangeSnapshot('update "merchants" set "settings" = $1')).toBe(true);
  });

  it("writes to tables the snapshot never reads do not count", () => {
    expect(mayChangeSnapshot('insert into "wa_messages" ("id") values ($1)')).toBe(false);
    expect(mayChangeSnapshot('update "wa_messages" set "status" = $1 where "wamid" = $2')).toBe(false);
    expect(mayChangeSnapshot('insert into "conversations" ("id") values ($1)')).toBe(false);
    expect(mayChangeSnapshot('insert into "audit_log" ("id") values ($1)')).toBe(false);
  });

  it("a select with a write hidden in a CTE counts", () => {
    expect(mayChangeSnapshot('with x as (update "products" set "stock_qty" = 1 returning *) select * from x')).toBe(true);
  });

  it("unknown input counts (safe side)", () => {
    expect(mayChangeSnapshot(undefined)).toBe(true);
    expect(mayChangeSnapshot("vacuum")).toBe(true);
  });
});
