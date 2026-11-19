"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/ui/table";
import { rupees } from "@/lib/format";
import type { ReportData, TopItem } from "@/lib/reports/build";
import type { ApiState } from "@/lib/ui/api";
import { usePeriod } from "@/lib/ui/period";
import { qty } from "./lines";
import { Region } from "./region";
import type { OverviewPayload } from "./types";

export const TOP_COLS: readonly Column<TopItem>[] = [
  { key: "name", header: "Item", cell: (t) => t.name, primary: true },
  { key: "qty", header: "Bika", num: true, cell: (t) => `${qty(t.qty)} ${t.unit}`.trim() },
  { key: "rev", header: "Sales", num: true, cell: (t) => rupees(t.revenuePaise) },
  { key: "profit", header: "Munafa", num: true, cell: (t) => rupees(t.profitPaise) },
];

function Body({ report }: { report: ReportData }) {
  const { name, setPeriod } = usePeriod();
  return (
    <DataTable
      caption="Sabse zyada sales wale item"
      columns={TOP_COLS}
      rows={report.topByRevenue}
      rowKey={(t) => t.productId}
      empty={
        <EmptyState
          title="Is period mein koi item nahi bika"
          description="Bill banne par sabse zyada bikne wale item yahan sales ke hisaab se judenge."
          action={
            name !== "last_30_days" ? (
              <Button variant="secondary" onClick={() => setPeriod("last_30_days")}>
                Pichhle 30 din dekho
              </Button>
            ) : undefined
          }
        />
      }
    />
  );
}

/** Top items by sales, with their profit beside them. */
export function TopSellers({ state }: { state: ApiState<OverviewPayload> }) {
  return (
    <section aria-labelledby="top-h" className="ov-sec">
      <div className="ov-head">
        <h2 id="top-h">Sabse zyada bikne wale</h2>
      </div>
      <Region state={state} errorTitle="Top items nahi khul paye" skeleton={<Skeleton shape="rows" count={5} cols={4} label="Top items load ho rahe hain" />}>
        {(d) => <Body report={d.report} />}
      </Region>
    </section>
  );
}
