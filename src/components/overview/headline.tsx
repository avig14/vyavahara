"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { num, rupees } from "@/lib/format";
import type { ApiState } from "@/lib/ui/api";
import type { ReportData } from "@/lib/reports/build";
import { Region } from "./region";
import { useL, type L } from "@/lib/ui/lang";
import type { OverviewPayload } from "./types";

function changeNote(s: ReportData["sales"], l: L): string {
  if (s.changePct === null)
    return l(
      "No data for the previous period",
      "पिछली अवधि का डेटा नहीं है",
      "Pichhle period ka data nahi hai",
    );
  if (s.changePct === 0)
    return l(
      `Same as the previous period (${rupees(s.prevTotalPaise)})`,
      `पिछली अवधि जितनी ही (${rupees(s.prevTotalPaise)})`,
      `Pichhle period jitni hi (${rupees(s.prevTotalPaise)})`,
    );
  {
    const pct = Math.abs(s.changePct);
    const down = s.changePct < 0;
    return l(
      `${pct}% ${down ? "lower" : "higher"} than the previous period (was ${rupees(s.prevTotalPaise)})`,
      `पिछली अवधि से ${pct}% ${down ? "कम" : "ज़्यादा"} (तब ${rupees(s.prevTotalPaise)})`,
      `Pichhle period se ${pct}% ${down ? "kam" : "zyada"} (tab ${rupees(s.prevTotalPaise)})`,
    );
  }
}

function Split({
  rows,
}: {
  rows: { label: string; value: string; tone?: "danger" }[];
}) {
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
  const l = useL();
  return (
    <div className="ov-figs">
      <div className="ov-fig">
        <Stat
          size="lg"
          label={l("Sales", "बिक्री", "Bikri")}
          figure={rupees(sales.totalPaise)}
          note={changeNote(sales, l)}
        />
        <Split
          rows={[
            { label: "UPI", value: rupees(sales.upiPaise) },
            { label: "Cash", value: rupees(sales.cashPaise) },
            ...(sales.refundsPaise > 0
              ? [
                  {
                    label: l(
                      "Refunds, already deducted above",
                      "रिफंड, ऊपर के जोड़ में कटा",
                      "Refund, upar ke jod mein kata",
                    ),
                    value: rupees(-sales.refundsPaise),
                    tone: "danger" as const,
                  },
                ]
              : []),
            { label: l("Bills", "बिल", "Bills"), value: num(sales.bills) },
            {
              label: l("Average bill", "औसत बिल", "Average bill"),
              value: rupees(sales.avgBillPaise),
            },
          ]}
        />
      </div>
      <div className="ov-fig">
        <Stat
          size="lg"
          label={l("Profit", "मुनाफ़ा", "Munafa")}
          figure={rupees(profit.netPaise)}
          tone={profit.netPaise < 0 ? "danger" : "neutral"}
          note={l(
            "Gross profit minus expenses",
            "कुल मुनाफ़ा घटा ख़र्चा",
            "Gross munafa minus kharcha",
          )}
        />
        <Split
          rows={[
            {
              label: l("Gross profit", "कुल मुनाफ़ा", "Gross munafa"),
              value: rupees(profit.grossPaise),
            },
            {
              label: l("Expenses", "ख़र्चा", "Kharcha"),
              value: rupees(-profit.expensesPaise),
            },
          ]}
        />
      </div>
    </div>
  );
}

/** The two numbers the owner opens the app for. */
export function Headline({ state }: { state: ApiState<OverviewPayload> }) {
  const l = useL();
  return (
    <Region
      state={state}
      errorTitle={l(
        "Could not load sales and profit",
        "बिक्री और मुनाफ़ा नहीं खुल पाए",
        "Sales aur profit nahi khul paye",
      )}
      skeleton={
        <Skeleton
          shape="stat"
          count={2}
          label={l(
            "Loading sales and profit",
            "बिक्री और मुनाफ़ा लोड हो रहे हैं",
            "Sales aur profit load ho rahe hain",
          )}
        />
      }
    >
      {(d) => <Body report={d.report} />}
    </Region>
  );
}
