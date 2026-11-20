"use client";

import { Button } from "@/components/ui/button";
import { T, useL, type L } from "@/lib/ui/lang";
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

const topCols = (l: L): readonly Column<TopItem>[] => [
  {
    key: "name",
    header: l("Item", "आइटम", "Item"),
    cell: (t) => t.name,
    primary: true,
  },
  {
    key: "qty",
    header: l("Sold", "बिका", "Bika"),
    num: true,
    cell: (t) => `${qty(t.qty)} ${t.unit}`.trim(),
  },
  {
    key: "rev",
    header: l("Sales", "बिक्री", "Sales"),
    num: true,
    cell: (t) => rupees(t.revenuePaise),
  },
  {
    key: "profit",
    header: l("Profit", "मुनाफ़ा", "Munafa"),
    num: true,
    cell: (t) => rupees(t.profitPaise),
  },
];

function Body({ report }: { report: ReportData }) {
  const l = useL();
  const { name, setPeriod } = usePeriod();
  return (
    <DataTable
      caption={l(
        "Items with the most sales",
        "सबसे ज़्यादा बिक्री वाले आइटम",
        "Sabse zyada sales wale item",
      )}
      columns={topCols(l)}
      rows={report.topByRevenue}
      rowKey={(t) => t.productId}
      empty={
        <EmptyState
          title={l(
            "No item sold in this period",
            "इस अवधि में कोई आइटम नहीं बिका",
            "Is period mein koi item nahi bika",
          )}
          description={l(
            "Once bills are made, the best-selling items will be listed here by sales.",
            "बिल बनने पर सबसे ज़्यादा बिकने वाले आइटम यहाँ बिक्री के हिसाब से जुड़ेंगे।",
            "Bill banne par sabse zyada bikne wale item yahan sales ke hisaab se judenge.",
          )}
          action={
            name !== "last_30_days" ? (
              <Button
                variant="secondary"
                onClick={() => setPeriod("last_30_days")}
              >
                {l(
                  "See the last 30 days",
                  "पिछले 30 दिन देखें",
                  "Pichhle 30 din dekho",
                )}
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
  const l = useL();
  return (
    <section aria-labelledby="top-h" className="ov-sec">
      <div className="ov-head">
        <h2 id="top-h">
          <T k="ov.top" />
        </h2>
      </div>
      <Region
        state={state}
        errorTitle={l(
          "Could not load top items",
          "टॉप आइटम नहीं खुल पाए",
          "Top items nahi khul paye",
        )}
        skeleton={
          <Skeleton
            shape="rows"
            count={5}
            cols={4}
            label={l(
              "Loading top items",
              "टॉप आइटम लोड हो रहे हैं",
              "Top items load ho rahe hain",
            )}
          />
        }
      >
        {(d) => <Body report={d.report} />}
      </Region>
    </section>
  );
}
