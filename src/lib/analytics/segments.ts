/** PRD P1 customer segments. Thresholds come from settings.customers. Pure. */
import type { Snapshot } from "../domain";
import { sum } from "../domain";
import { addDays, istDayKey, istDaysBetween } from "../time";

export type Segment = "regular" | "new" | "lapsed" | "occasional";

export interface CustomerSegment {
  customerId: string;
  name: string;
  segment: Segment;
  visits30: number;
  lastVisitDaysAgo: number | null;
  spend30Paise: number;
  /** total spend over history, used to rank the call list */
  lifetimePaise: number;
}

export interface SegmentOverview {
  customers: CustomerSegment[];
  counts: Record<Segment, number>;
  lapsed: CustomerSegment[];
}

export function segmentCustomers(snap: Snapshot): SegmentOverview {
  const cfg = snap.settings.customers;
  const win = cfg.regularWindowDays;
  const visitsBy = new Map<string, { at: Date; amount: number }[]>();
  for (const t of snap.transactions) {
    if (!t.customerId || t.kind !== "sale") continue;
    const arr = visitsBy.get(t.customerId) ?? [];
    arr.push({ at: t.createdAt, amount: t.amountPaise });
    visitsBy.set(t.customerId, arr);
  }

  const out: CustomerSegment[] = [];
  for (const c of snap.customers) {
    const v = (visitsBy.get(c.id) ?? []).sort((a, b) => a.at.getTime() - b.at.getTime());
    if (!v.length) continue;
    const days = [...new Set(v.map((x) => istDayKey(x.at)))].sort();
    const last = v[v.length - 1].at;
    const lastAgo = istDaysBetween(last, snap.now);
    const recent = v.filter((x) => x.at >= addDays(snap.now, -win));
    const visits30 = new Set(recent.map((x) => istDayKey(x.at))).size;
    const firstSeen = v[0].at < c.createdAt ? v[0].at : c.createdAt;
    const sinceFirst = istDaysBetween(firstSeen, snap.now);

    // Was regular: ≥ N visit-days inside the window ending at the last visit.
    const lastWinStart = addDays(last, -win);
    const wasRegular = new Set(v.filter((x) => x.at >= lastWinStart).map((x) => istDayKey(x.at))).size >= cfg.regularVisits;

    let segment: Segment = "occasional";
    if (visits30 >= cfg.regularVisits) segment = "regular";
    else if (sinceFirst <= cfg.newDays) segment = "new";
    else if (lastAgo >= cfg.lapsedDays && lastAgo <= 60 + cfg.lapsedDays && wasRegular) segment = "lapsed";
    void days;

    out.push({
      customerId: c.id,
      name: c.name,
      segment,
      visits30,
      lastVisitDaysAgo: lastAgo,
      spend30Paise: sum(recent.map((x) => x.amount)),
      lifetimePaise: sum(v.map((x) => x.amount)),
    });
  }

  const counts: Record<Segment, number> = { regular: 0, new: 0, lapsed: 0, occasional: 0 };
  for (const c of out) counts[c.segment]++;
  const lapsed = out.filter((c) => c.segment === "lapsed").sort((a, b) => b.lifetimePaise - a.lifetimePaise);
  return { customers: out, counts, lapsed };
}
