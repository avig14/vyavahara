"use client";

import { BarSeries, compactRupees } from "@/components/charts";
import { Badge, EmptyState, Stat, Stats } from "@/components/ui";
import { num, rupees } from "@/lib/format";
import type { GrowthResponse } from "./types";

export function LoanTab({ loan }: { loan: GrowthResponse["loan"] }) {
  if (loan.monthlyUpiPaise.length === 0) {
    return <EmptyState title="Not enough UPI history" description="The loan check looks at your monthly UPI receipts. It shows up once there are some." />;
  }
  const bars = loan.monthlyUpiPaise.map((v, i, a) => ({
    label: i === a.length - 1 ? "Latest 30 days" : `${a.length - 1 - i} blocks back`,
    value: v,
    highlight: i === a.length - 1,
  }));
  const growth = loan.growth * 100;

  return (
    <div>
      <section className="gr-sec" aria-label="Eligibility">
        <div className="gr-verdict">
          <h2>
            {loan.eligible ? "You look eligible" : "Not eligible yet"} <Badge tone={loan.eligible ? "success" : "warn"}>{loan.eligible ? "Indicative yes" : "Indicative no"}</Badge>
          </h2>
          {loan.eligible ? (
            <p className="gr-note">Based on your UPI receipts, a lender may offer up to the amount below. The lender decides.</p>
          ) : (
            <p className="gr-note">Your UPI receipts do not meet the check yet. The reasons are below.</p>
          )}
        </div>
        <Stats>
          {loan.eligible ? <Stat label="Indicative maximum" figure={rupees(loan.indicativeMaxPaise)} size="lg" /> : null}
          <Stat label="Average monthly UPI" figure={rupees(loan.avgMonthlyUpiPaise)} />
          <Stat label="Share of sales on UPI" figure={`${num(loan.upiShare * 100)}%`} />
          <Stat label="Change, first to latest month" figure={`${growth > 0 ? "+" : ""}${num(growth, 1)}%`} tone={growth < 0 ? "danger" : "neutral"} />
        </Stats>
      </section>

      <section className="gr-sec" aria-label="Why">
        <div className="gr-head">
          <h2>What the check saw</h2>
        </div>
        <ul className="gr-list">
          {loan.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
          <li>{loan.cv === null ? "UPI inflow steadiness could not be measured." : `Month-to-month swing in UPI inflow is ${num(loan.cv, 2)}. Lower means steadier.`}</li>
        </ul>
        {loan.recommendation ? <p className="gr-note">{loan.recommendation}</p> : null}
      </section>

      <section className="gr-sec" aria-label="Monthly UPI">
        <div className="gr-head">
          <h2>UPI receipts, last {loan.monthlyUpiPaise.length} blocks of 30 days</h2>
        </div>
        <BarSeries
          data={bars}
          format={rupees}
          axisFormat={compactRupees}
          summary={`UPI receipts per 30 days, oldest first: ${loan.monthlyUpiPaise.map((v) => rupees(v)).join(", ")}.`}
        />
      </section>

      <p className="gr-note">{loan.disclaimer}</p>
    </div>
  );
}
