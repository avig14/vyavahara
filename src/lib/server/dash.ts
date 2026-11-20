/** Dashboard data loaders. Routes stay one-liners; everything numeric comes from the tested analytics. */
import type { Ctx } from "./http";
import { loadSnapshot } from "../db/queries";
import { buildContext, detectRecommendations, type RecContext, type Recommendation } from "../analytics/recommendations";
import type { Snapshot } from "../domain";
import { isPeriodName, type PeriodName } from "../time";
import { scheduleKhataAlerts } from "./alerts-hook";

export interface Dash {
  snap: Snapshot;
  cx: RecContext;
  recs: Recommendation[];
}

export async function loadDash(c: Ctx): Promise<Dash> {
  const snap = await loadSnapshot(c.db, c.merchantId, { now: c.now });
  const cx = buildContext(snap);
  scheduleKhataAlerts(c, snap);
  return { snap, cx, recs: detectRecommendations(snap, cx) };
}

/** `?period=this_week` or `?period=custom&from=ISO&to=ISO`. Bad input falls back to today. */
export function parsePeriod(url: URL): { period: PeriodName; custom?: { from: Date; to: Date } } {
  const p = url.searchParams.get("period") ?? "today";
  const period: PeriodName = isPeriodName(p) ? p : "today";
  if (period !== "custom") return { period };
  const from = new Date(url.searchParams.get("from") ?? "");
  const to = new Date(url.searchParams.get("to") ?? "");
  if (isNaN(+from) || isNaN(+to) || to <= from) return { period: "today" };
  return { period, custom: { from, to } };
}
