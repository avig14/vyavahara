/**
 * Why this exists: `loadSnapshot` reads ~3 MB per call and Neon's free plan allows 5 GB of public
 * network transfer a month. Pages and bots asked for the same unchanged data again and again, and the
 * project hit the cap (HTTP 402). This cache makes an unchanged snapshot cost one tiny version probe
 * instead of a full read.
 *
 * A cached copy is served only when all three hold:
 *  1. `merchants.data_version` in the database is still the number we saw when we loaded it.
 *     Every request that wrote something bumps it once, so this is correct across Vercel instances.
 *  2. No write was started or finished on THIS instance since we loaded (instant local invalidation,
 *     also closes the window between "write sent" and "version bumped").
 *  3. It is younger than the TTL (safety net for edits made outside the app).
 *
 * Pure on purpose: no database, no clock of its own beyond the injected one. See snapshot-cache.test.ts.
 */

interface Entry {
  value: unknown;
  version: number;
  epoch: number;
  at: number;
}

interface Flight {
  promise: Promise<unknown>;
  version: number;
  epoch: number;
}

export const SNAPSHOT_TTL_MS = 10 * 60_000;

export class SnapshotCache {
  private readonly entries = new Map<string, Entry>();
  private readonly flights = new Map<string, Flight>();
  private epoch = 0;
  private writes = 0;
  private flushed = 0;

  constructor(
    private readonly ttlMs = SNAPSHOT_TTL_MS,
    private readonly clock: () => number = Date.now,
  ) {}

  /** A write was just sent or just finished: nothing cached before this moment may be served. */
  noteWrite(): void {
    this.epoch++;
    this.writes++;
  }

  /** True when this instance wrote since the last time the database version was bumped. */
  get dirty(): boolean {
    return this.writes > this.flushed;
  }

  /** Call right before bumping the database version. Returns the mark to pass to `flushed`. */
  beginFlush(): number {
    this.epoch++;
    return this.writes;
  }

  /** The version bump went through for every write up to `mark`. */
  endFlush(mark: number): void {
    this.flushed = Math.max(this.flushed, mark);
    this.epoch++;
  }

  /**
   * `probe` reads the current version (a few bytes). `load` reads the data (the expensive part).
   * The version is read BEFORE the data, so a write that lands in between can only make the stored
   * entry look older than it is, which forces one extra reload and never serves stale data.
   * If the probe itself fails we skip the cache and just load.
   */
  async get<T>(key: string, probe: () => Promise<number>, load: () => Promise<T>): Promise<T> {
    let version: number;
    try {
      version = await probe();
    } catch {
      return load();
    }

    const hit = this.entries.get(key);
    if (hit && hit.version === version && hit.epoch === this.epoch && this.clock() - hit.at < this.ttlMs) return hit.value as T;

    const flight = this.flights.get(key);
    if (flight && flight.version === version && flight.epoch === this.epoch) return flight.promise as Promise<T>;

    const epoch = this.epoch;
    const promise: Promise<T> = load()
      .then((value) => {
        if (this.epoch === epoch) this.entries.set(key, { value, version, epoch, at: this.clock() });
        return value;
      })
      .finally(() => {
        if (this.flights.get(key)?.promise === promise) this.flights.delete(key);
      });
    this.flights.set(key, { promise, version, epoch });
    return promise;
  }

  /** Forget everything (tests, and when the connection string changes). */
  clear(): void {
    this.entries.clear();
    this.flights.clear();
    this.epoch++;
  }
}

/** One per server instance. */
export const snapshotCache = new SnapshotCache();

/** Tables `loadSnapshot` never reads. Writing to them cannot make a cached snapshot stale (delivery receipts, chat log, ...). */
const NOT_IN_SNAPSHOT = ["wa_messages", "wa_sessions", "conversations", "audit_log", "alerts", "pending_actions", "artifacts", "recommendations_log", "soundbox_events", "stock_movements"];
const OFF_SNAPSHOT_WRITE = new RegExp(String.raw`^\s*(insert\s+into|update|delete\s+from)\s+"?(${NOT_IN_SNAPSHOT.join("|")})"?[\s(]`, "i");

/**
 * Could this statement change what a snapshot contains? Reads and writes to tables the snapshot does not
 * load say no; everything else says yes. Unsure means yes: a wrong yes costs one reload, a wrong no serves stale data.
 */
export function mayChangeSnapshot(text: unknown): boolean {
  if (typeof text !== "string") return true;
  if (/^\s*(select|show|explain)\b/i.test(text) && !/\b(insert|update|delete)\b/i.test(text.replace(/'[^']*'/g, "''"))) return false;
  return !OFF_SNAPSHOT_WRITE.test(text);
}
