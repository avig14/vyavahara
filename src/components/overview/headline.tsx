"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { num, rupees } from "@/lib/format";
import type { ApiState } from "@/lib/ui/api";
import type { ReportData } from "@/lib/reports/build";
import { Region } from "./region";
import type { OverviewPayload } from "./types";

function changeNote(s: ReportData["sales"]): string {
  if (s.changePct === null) return "Pichhle period ka data nahi hai";
  if (s.changePct === 0) return `Pichhle period jitni hi (${rupees(s.prevTotalPaise)})`;
  return `Pichhle period se ${Math.abs(s.changePct)}% ${s.changePct < 0 ? "kam" : "zyada"} (tab ${rupees(s.prevTotalPaise)})`;
}

function Split({ rows }: { rows: { label: string; value: string; tone?: "danger" }[] }) {
  return (
    <dl className="ov-split">
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd className="num" data-tone={r.tone}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Body({ report }: { report: ReportData }) {
  const { sales, profit } = report;
  return (
    <div className="ov-figs">
      <div className="ov-fig">
        <Stat size="lg" label="Sales (bikri)" figure={rupees(sales.totalPaise)} note={changeNote(sales)} />
        <Split
          rows={[
            { label: "UPI", value: rupees(sales.upiPaise) },
            { label: "Cash", value: rupees(sales.cashPaise) },
            ...(sales.refundsPaise > 0 ? [{ label: "Refund, upar ke jod mein kata", value: rupees(-sales.refundsPaise), tone: "danger" as const }] : []),
            { label: "Bills", value: num(sales.bills) },
            { label: "Average bill", value: rupees(sales.avgBillPaise) },
          ]}
        />
      </div>
      <div className="ov-fig">
        <Stat size="lg" label="Profit (munafa)" figure={rupees(profit.netPaise)} tone={profit.netPaise < 0 ? "danger" : "neutral"} note="Gross munafa minus kharcha" />
        <Split
          rows={[
            { label: "Gross munafa", value: rupees(profit.grossPaise) },
            { label: "Kharcha", value: rupees(-profit.expensesPaise) },
          ]}
        />
      </div>
    </div>
  );
}

/** The two numbers the owner opens the app for. */
export function Headline({ state }: { state: ApiState<OverviewPayload> }) {
  return (
    <Region state={state} errorTitle="Sales aur profit nahi khul paye" skeleton={<Skeleton shape="stat" count={2} label="Sales aur profit load ho rahe hain" />}>
      {(d) => <Body report={d.report} />}
    </Region>
  );
}
