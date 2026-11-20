"use client";

import Link from "next/link";
import { T, useL, type L } from "@/lib/ui/lang";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Column } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { num, rupees } from "@/lib/format";
import { anomalyText } from "@/lib/ui/api-text";
import type { ReportData } from "@/lib/reports/build";
import type { ApiState } from "@/lib/ui/api";
import { Region } from "./region";
import type { OverviewPayload } from "./types";

const stockDays = (d: number, l: L) =>
  !isFinite(d)
    ? l("many days", "बहुत दिन", "bahut din")
    : d < 1
      ? l("today only", "बस आज", "aaj hi")
      : `${Math.round(d)} ${l("days", "दिन", "din")}`;

type StockRow = ReportData["stockAlerts"]["out"][number];
type KhataRow = ReportData["khata"]["red"][number];
type PayRow = ReportData["payablesDue"][number];

function Block({
  id,
  title,
  href,
  linkLabel,
  children,
}: {
  id: string;
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="ov-blk">
      <div className="ov-blk-head">
        <h3 id={id}>{title}</h3>
        {href ? (
          <Link href={href} className="ov-link">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const stockCols = (l: L): readonly Column<StockRow>[] => [
  {
    key: "item",
    header: l("Item", "आइटम", "Item"),
    cell: (f) => f.name,
    primary: true,
  },
  {
    key: "left",
    header: l("Left", "बचा", "Bacha"),
    num: true,
    cell: (f) => num(f.stock, 1),
  },
  {
    key: "st",
    header: l("Status", "स्थिति", "Status"),
    cell: (f) =>
      f.status === "stockout" ? (
        <Badge tone="danger">{l("Out", "ख़त्म", "Khatam")}</Badge>
      ) : (
        <Badge tone="warn">
          {l(
            `${stockDays(f.daysToStockout, l)} of stock`,
            `${stockDays(f.daysToStockout, l)} का स्टॉक`,
            `${stockDays(f.daysToStockout, l)} ka stock`,
          )}
        </Badge>
      ),
  },
];

const khataCols = (l: L): readonly Column<KhataRow>[] => [
  {
    key: "who",
    header: l("Customer", "ग्राहक", "Customer"),
    cell: (a) => a.name,
    primary: true,
  },
  {
    key: "old",
    header: l("Oldest", "सबसे पुराना", "Sabse purana"),
    num: true,
    cell: (a) =>
      l(
        `${num(a.oldestUnpaidDays)} days`,
        `${num(a.oldestUnpaidDays)} दिन`,
        `${num(a.oldestUnpaidDays)} din`,
      ),
  },
  {
    key: "due",
    header: l("Due", "बाक़ी", "Baaki"),
    num: true,
    cell: (a) => <span className="ov-due">{rupees(a.outstandingPaise)}</span>,
  },
];

function dueBadge(p: PayRow, l: L) {
  if (p.dueInDays < 0)
    return (
      <Badge tone="danger">
        {l(
          `${-p.dueInDays} ${-p.dueInDays === 1 ? "day" : "days"} late`,
          `${-p.dueInDays} दिन लेट`,
          `${-p.dueInDays} din late`,
        )}
      </Badge>
    );
  if (p.dueInDays === 0)
    return <Badge tone="warn">{l("Today", "आज", "Aaj")}</Badge>;
  return (
    <Badge tone="neutral">
      {l(
        `in ${p.dueInDays} ${p.dueInDays === 1 ? "day" : "days"}`,
        `${p.dueInDays} दिन में`,
        `${p.dueInDays} din mein`,
      )}
    </Badge>
  );
}

const payCols = (l: L): readonly Column<PayRow>[] => [
  {
    key: "vendor",
    header: l("Supplier", "सप्लायर", "Supplier"),
    cell: (p) => p.vendorName,
    primary: true,
  },
  { key: "due", header: l("Due", "देय", "Due"), cell: (p) => dueBadge(p, l) },
  {
    key: "amt",
    header: l("Amount", "रक़म", "Amount"),
    num: true,
    cell: (p) => rupees(p.amountPaise),
  },
];

const none = (text: string) => <p className="ov-none">{text}</p>;

function Body({ report }: { report: ReportData }) {
  const l = useL();
  const stock = [...report.stockAlerts.out, ...report.stockAlerts.runningOut];
  const dead = report.stockAlerts.dead;
  const lost = report.lostSales;
  const { khata, payablesDue, anomalies } = report;
  const nothing =
    stock.length === 0 &&
    dead.length === 0 &&
    lost.requests === 0 &&
    khata.red.length === 0 &&
    payablesDue.length === 0 &&
    anomalies.length === 0;

  if (nothing)
    return (
      <EmptyState
        title={l("All good", "सब ठीक है", "Sab theek hai")}
        description={l(
          "No item is out, no udhaar is in the red, no supplier payment is pending.",
          "कोई आइटम ख़त्म नहीं, कोई उधार लाल में नहीं, कोई सप्लायर पेमेंट बाक़ी नहीं।",
          "Koi item khatam nahi, koi udhaar red mein nahi, koi vendor payment pending nahi.",
        )}
      />
    );

  return (
    <div className="ov-blks">
      <Block
        id="al-stock"
        title={l("Stock", "स्टॉक", "Stock")}
        href="/dashboard/inventory"
        linkLabel={l("Full stock", "पूरा स्टॉक", "Poora stock")}
      >
        {stock.length ? (
          <DataTable
            caption={l(
              "Items that are out or about to run out",
              "ख़त्म या जल्दी ख़त्म होने वाले आइटम",
              "Khatam ya jaldi khatam hone wale item",
            )}
            columns={stockCols(l)}
            rows={stock}
            rowKey={(f) => f.productId}
            dense
          />
        ) : (
          none(
            l(
              "No item is out or low.",
              "कोई आइटम ख़त्म या कम नहीं।",
              "Koi item khatam ya kam nahi.",
            ),
          )
        )}
        {dead.length ? (
          <p className="ov-line">
            {l("Not selling", "बिक नहीं रहा", "Nahi bik raha")}:{" "}
            {dead.map((f) => f.name).join(", ")} ({num(dead.length)}{" "}
            {l("items", "आइटम", "item")})
          </p>
        ) : null}
        {lost.requests > 0 ? (
          <p className="ov-line">
            {l(
              "Customers asked for these but they were out of stock",
              "ग्राहकों ने माँगा पर स्टॉक में नहीं था",
              "Customers ne maanga par stock mein nahi tha",
            )}
            : {lost.top ? `${lost.top.name}, ` : ""}
            {num(lost.requests)}{" "}
            {l("times. Lost sales", "बार। गई हुई बिक्री", "baar. Gayi hui bikri")}{" "}
            {rupees(lost.totalPaise)}.
          </p>
        ) : null}
      </Block>

      <Block
        id="al-khata"
        title={l("Khata, in the red", "खाता, लाल में", "Khata, red mein")}
        href="/dashboard/khata"
        linkLabel={l("Full khata", "पूरा खाता", "Poora khata")}
      >
        {khata.red.length ? (
          <DataTable
            caption={l(
              "Customers with khata in the red",
              "लाल में खाता वाले ग्राहक",
              "Red mein khata wale customers",
            )}
            columns={khataCols(l)}
            rows={khata.red}
            rowKey={(a) => a.customerId}
            dense
          />
        ) : (
          none(
            l(
              "No customer is in the red.",
              "कोई ग्राहक लाल में नहीं।",
              "Koi customer red mein nahi.",
            ),
          )
        )}
        <p className="ov-line">
          {l("Total due", "कुल बाक़ी", "Kul baaki")}{" "}
          <span className="num">{rupees(khata.totalDuePaise)}</span>,{" "}
          {l("collected this period", "इस अवधि में वसूल", "is period mein wasool")}{" "}
          <span className="num">{rupees(khata.collectedPaise)}</span>.
        </p>
      </Block>

      <Block
        id="al-pay"
        title={l(
          "Supplier payments due",
          "सप्लायर पेमेंट बाक़ी",
          "Supplier payments due",
        )}
        href="/dashboard/vendors"
        linkLabel={l("All suppliers", "सभी सप्लायर", "Saare suppliers")}
      >
        {payablesDue.length ? (
          <DataTable
            caption={l(
              "Supplier payments that are due",
              "जो सप्लायर पेमेंट बाक़ी हैं",
              "Supplier payments jo due hain",
            )}
            columns={payCols(l)}
            rows={payablesDue}
            rowKey={(p) => p.purchaseId}
            dense
          />
        ) : (
          none(
            l(
              "No payment is due.",
              "कोई पेमेंट बाक़ी नहीं।",
              "Koi payment due nahi.",
            ),
          )
        )}
      </Block>

      <Block
        id="al-odd"
        title={l("Something unusual", "कुछ अलग दिखा", "Kuch alag dikha")}
      >
        {anomalies.length ? (
          <ul className="ov-odd">
            {anomalies.map((a, i) => (
              <li key={`${a.kind}-${i}`}>
                {anomalyText(a, l)}
                {a.kind === "item_drop" ? (
                  <>
                    {" "}
                    <Link href="/dashboard/inventory" className="ov-link">
                      {l("See stock", "स्टॉक देखें", "Stock dekho")}
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          none(
            l(
              "Nothing unusual.",
              "कोई अलग बात नहीं दिखी।",
              "Koi alag baat nahi dikhi.",
            ),
          )
        )}
      </Block>
    </div>
  );
}

/** Everything that needs a decision: stock, khata, supplier bills, odd days. Each block links to its page. */
export function Alerts({ state }: { state: ApiState<OverviewPayload> }) {
  const l = useL();
  return (
    <section aria-labelledby="alerts-h" className="ov-sec">
      <div className="ov-head">
        <h2 id="alerts-h">
          <T k="ov.alerts" />
        </h2>
      </div>
      <Region
        state={state}
        errorTitle={l(
          "Could not load alerts",
          "अलर्ट नहीं खुल पाए",
          "Alerts nahi khul paye",
        )}
        skeleton={
          <Skeleton
            shape="rows"
            count={6}
            cols={3}
            label={l(
              "Loading alerts",
              "अलर्ट लोड हो रहे हैं",
              "Alerts load ho rahe hain",
            )}
          />
        }
      >
        {(d) => <Body report={d.report} />}
      </Region>
    </section>
  );
}
