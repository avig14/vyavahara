"use client";

import { Badge, Disclosure, EmptyState, SkeletonBlock, SkeletonRows } from "@/components/ui";
import { num, rupees } from "@/lib/format";
import { LostEmpty, LostTable } from "./lost-sales";
import { coverLabel, STATUS_META } from "./status";
import type { InventoryPayload, ItemForecast } from "./types";

interface RegionProps {
  data: InventoryPayload | undefined;
  loading: boolean;
  failed: boolean;
}

/** One line shown in place of a region when the whole stock call failed; the retry lives on the table. */
function Blocked() {
  return <p className="stk-note">Stock list load nahi hui, isliye yeh bhi nahi dikh raha. Table ke paas wala Try again dabao.</p>;
}

const RANK = { stockout: 0, reorder: 1 } as const;

/** Items the API says need an order now, with its suggested quantity. Nothing is computed here. */
export function ReorderList({ data, loading, failed, onSelect }: RegionProps & { onSelect: (productId: string) => void }) {
  const items: ItemForecast[] = data
    ? data.forecasts
        .filter((f): f is ItemForecast & { status: "stockout" | "reorder" } => f.status === "stockout" || f.status === "reorder")
        .sort((a, b) => RANK[a.status] - RANK[b.status] || a.coverDays - b.coverDays)
    : [];
  return (
    <section className="stk-sec" aria-labelledby="stk-reorder">
      <h2 id="stk-reorder" className="stk-h">
        Abhi order karna hai
      </h2>
      {failed ? (
        <Blocked />
      ) : !data && loading ? (
        <SkeletonRows rows={3} cols={2} />
      ) : items.length === 0 ? (
        <EmptyState title="Abhi koi order baaki nahi" description="Koi item khatam ya reorder point ke neeche nahi hai." />
      ) : (
        <ul className="stk-list">
          {items.map((f) => (
            <li key={f.productId} className="stk-pick">
              <button type="button" className="stk-pick-name" onClick={() => onSelect(f.productId)}>
                {f.name}
              </button>
              <span className="stk-pick-meta">
                <span className="stk-pick-qty num">{f.suggestedOrderQty > 0 ? `${num(f.suggestedOrderQty)} mangwao` : "Qty nahi bani"}</span>
                <Badge tone={STATUS_META[f.status].tone}>{STATUS_META[f.status].label}</Badge>
                <span>
                  {num(f.stock, 1)} bacha, cover {coverLabel(f.coverDays)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Everything the shop could not sell because the item was not there. */
export function LostSales({ data, loading, failed }: RegionProps) {
  const names = data ? new Map(data.forecasts.map((f) => [f.productId, f.name])) : undefined;
  return (
    <section className="stk-sec" aria-labelledby="stk-lost">
      <h2 id="stk-lost" className="stk-h">
        Jo maanga par nahi mila
      </h2>
      {failed ? (
        <Blocked />
      ) : !data && loading ? (
        <SkeletonBlock height="9rem" />
      ) : !data || data.lostDemand.rows.length === 0 ? (
        <LostEmpty />
      ) : (
        <>
          <p>
            <span className="figure stk-big">{rupees(data.lostDemand.totalPaise)}</span>
            <span className="stk-note"> ki bikri chhooti, stock na hone se.</span>
          </p>
          <Disclosure summary="Pichhle requests" meta={`${num(data.lostDemand.rows.length)} dikhaye`}>
            <LostTable rows={data.lostDemand.rows} names={names} caption="Lost sales, newest first" />
          </Disclosure>
        </>
      )}
    </section>
  );
}
