"use client";

import type { FestivalPlan, FestivalPlanItem, UpcomingFestival } from "@/lib/analytics/festival";
import { Badge, DataTable, Disclosure, EmptyState, Stat, Stats, type Column } from "@/components/ui";
import { num, rupees } from "@/lib/format";
import { dayLabel, humanize } from "@/lib/ui/ist-labels";

const FESTIVAL_COLS: readonly Column<UpcomingFestival>[] = [
  { key: "name", header: "Festival", primary: true, cell: (f) => f.name },
  { key: "date", header: "Date", cell: (f) => dayLabel(f.date) },
  { key: "away", header: "Days away", num: true, cell: (f) => num(f.daysAway) },
  { key: "cats", header: "Categories that sell more", cell: (f) => f.categories.map(humanize).join(", ") },
];

const ITEM_COLS: readonly Column<FestivalPlanItem>[] = [
  {
    key: "name",
    header: "Item",
    primary: true,
    cell: (i) => (
      <>
        {i.name}
        <span className="gr-sub">
          {humanize(i.category)}, sells {num(i.baselinePerDay, 1)} a day now
        </span>
      </>
    ),
  },
  {
    key: "up",
    header: "Festival uplift",
    num: true,
    cell: (i) => (
      <>
        {num(i.uplift, 1)}x
        <span className="gr-sub">{i.learned ? "from your past festivals" : "default estimate"}</span>
      </>
    ),
  },
  { key: "extra", header: "Extra units to stock", num: true, cell: (i) => num(i.extraUnits) },
  { key: "impact", header: "Extra profit", num: true, cell: (i) => rupees(i.impactPaise) },
];

const TOP_ITEMS = 8;

function PlanSection({ plan }: { plan: FestivalPlan }) {
  const f = plan.festival;
  const sorted = [...plan.items].sort((a, b) => b.impactPaise - a.impactPaise);
  const top = sorted.slice(0, TOP_ITEMS);
  const rest = sorted.slice(TOP_ITEMS);
  return (
    <section className="gr-sec" aria-label={`${f.name} stock-up plan`}>
      <div className="gr-head">
        <h3>
          {f.name}, {dayLabel(f.date)}
        </h3>
        <p>
          {f.daysAway === 0 ? "Today." : `${num(f.daysAway)} ${f.daysAway === 1 ? "day" : "days"} away.`} Extra profit is the extra units you can sell in the festival window, times your margin.
        </p>
      </div>
      <DataTable
        caption={`${f.name} stock-up plan, biggest gain first`}
        columns={ITEM_COLS}
        rows={top}
        rowKey={(i) => i.productId}
        dense
        empty={<EmptyState title="No sold items in these categories" description="Items appear here once they have sales history." />}
      />
      {rest.length > 0 ? (
        <Disclosure summary={`Show ${num(rest.length)} more items`}>
          <DataTable caption={`${f.name} stock-up plan, remaining items`} columns={ITEM_COLS} rows={rest} rowKey={(i) => i.productId} dense />
        </Disclosure>
      ) : null}
      {plan.items.length > 0 ? (
        <Stats>
          <Stat label="Total extra profit if stocked" figure={rupees(plan.totalImpactPaise)} tone="success" />
        </Stats>
      ) : null}
    </section>
  );
}

export function FestivalTab({ festivals, plans }: { festivals: UpcomingFestival[]; plans: FestivalPlan[] }) {
  if (festivals.length === 0) {
    return <EmptyState title="No festival in the next 60 days" description="When a festival comes within 60 days, its stock-up plan shows here." />;
  }
  const next = festivals[0];
  return (
    <div>
      <section className="gr-sec" aria-label="Upcoming festivals">
        <div className="gr-head">
          <h2>Upcoming festivals</h2>
          <p>
            Next is <Badge tone="info">{next.name}</Badge> on {dayLabel(next.date)}.
          </p>
        </div>
        <DataTable caption="Upcoming festivals" columns={FESTIVAL_COLS} rows={festivals} rowKey={(f) => `${f.name}-${f.date}`} dense />
      </section>
      {plans.length === 0 ? (
        <section className="gr-sec">
          <EmptyState title="No stock-up plan yet" description="Plans need items sold in the festival categories." />
        </section>
      ) : (
        plans.map((p) => <PlanSection key={`${p.festival.name}-${p.festival.date}`} plan={p} />)
      )}
    </div>
  );
}
