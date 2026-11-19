"use client";

import type { CashDay, CashFlow } from "@/lib/analytics/cashflow";
import { LineBand, compactRupees, type LinePoint } from "@/components/charts";
import { DataTable, EmptyState, Stat, Stats, type Column } from "@/components/ui";
import { rupees } from "@/lib/format";
import { dayLabel, dayLabelWeekday } from "@/lib/ui/ist-labels";

const money = (p: number) => <span className={p < 0 ? "gr-neg" : undefined}>{rupees(p)}</span>;
const dash = (p: number) => (p === 0 ? "-" : rupees(p));

const COLS: readonly Column<CashDay>[] = [
  { key: "date", header: "Day", primary: true, cell: (d) => dayLabelWeekday(d.date) },
  { key: "sales", header: "Sales in", num: true, cell: (d) => rupees(d.inflowSalesPaise) },
  { key: "coll", header: "Khata in", num: true, cell: (d) => rupees(d.inflowCollectionsPaise) },
  { key: "pay", header: "Vendor bills out", num: true, cell: (d) => dash(d.outflowPayablesPaise) },
  { key: "exp", header: "Expenses out", num: true, cell: (d) => dash(d.outflowExpensesPaise) },
  { key: "net", header: "Net", num: true, cell: (d) => money(d.netPaise) },
  { key: "run", header: "Running balance", num: true, cell: (d) => money(d.cumulativePaise) },
];

export function CashflowTab({ cashflow }: { cashflow: CashFlow }) {
  const { series, warnings } = cashflow;
  if (series.length === 0) {
    return <EmptyState title="No forecast yet" description="The 14-day cash forecast needs some sales history." />;
  }
  const points: LinePoint[] = series.map((d) => ({ label: dayLabel(d.date), forecast: d.cumulativePaise }));
  const low = series.reduce((a, b) => (b.cumulativePaise < a.cumulativePaise ? b : a));
  const first = series[0];
  const last = series[series.length - 1];
  const net = cashflow.totalInflowPaise - cashflow.totalOutflowPaise;

  return (
    <div>
      <section className="gr-sec" aria-label="Cash summary">
        <div className="gr-head">
          <h2>Next {series.length} days</h2>
          <p>
            {dayLabel(first.date)} to {dayLabel(last.date)}. Forecast sales and khata collections come in, vendor bills and fixed expenses go out. The running balance starts from the opening balance in Settings.
          </p>
        </div>
        <Stats>
          <Stat label="Expected in" figure={rupees(cashflow.totalInflowPaise)} note={`Khata collections ${rupees(cashflow.collectionsPaise)}`} />
          <Stat label="Expected out" figure={rupees(cashflow.totalOutflowPaise)} />
          <Stat label="Net" figure={rupees(net)} tone={net < 0 ? "danger" : "success"} />
          <Stat label="Lowest balance" figure={rupees(low.cumulativePaise)} note={dayLabel(low.date)} tone={low.cumulativePaise < 0 ? "danger" : "neutral"} />
        </Stats>
      </section>

      <section className="gr-sec" aria-label="Running balance chart">
        <div className="gr-head">
          <h2>Running balance</h2>
        </div>
        <LineBand
          points={points}
          forecastLabel="Running balance"
          format={rupees}
          axisFormat={compactRupees}
          summary={`Forecast running balance from ${dayLabel(first.date)} to ${dayLabel(last.date)}. Lowest ${rupees(low.cumulativePaise)} on ${dayLabel(low.date)}, ending ${rupees(last.cumulativePaise)}.`}
        />
      </section>

      {warnings.length > 0 ? (
        <section className="gr-sec" aria-label="Shortfall warnings">
          <div className="gr-head">
            <h2>Shortfalls to plan for</h2>
          </div>
          <ul className="gr-list">
            {warnings.map((w) => (
              <li key={w.purchaseId}>
                <strong>{dayLabel(w.date)}:</strong> {rupees(w.payablePaise)} to {w.vendorName} leaves you {rupees(w.shortfallPaise)} short.
                {w.suggestions.length > 0 ? ` ${w.suggestions[0].text}.` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="gr-sec" aria-label="Day by day">
        <div className="gr-head">
          <h2>Day by day</h2>
        </div>
        <DataTable caption="Expected cash in and out, day by day" columns={COLS} rows={series} rowKey={(d) => d.date} dense />
      </section>
    </div>
  );
}
