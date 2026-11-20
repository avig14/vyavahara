"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, Table, type Column } from "@/components/ui/table";
import { num, rupees } from "@/lib/format";
import type { ReportData, TopItem } from "@/lib/reports/build";
import { shortDay } from "@/lib/ui/dates";
import { useL, type L } from "@/lib/ui/lang";
import { qty } from "@/components/overview/lines";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const money = (p: number) => (
  <span className={p < 0 ? "rp-neg" : undefined}>{rupees(p)}</span>
);
const dayWord = (l: L) => l("days", "दिन", "din");

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rp-sec">
      <h3 id={id}>{title}</h3>
      {children}
      {note ? <p className="rp-note">{note}</p> : null}
    </section>
  );
}

const none = (text: string) => <p className="rp-note">{text}</p>;

interface Line {
  key: string;
  label: string;
  value: number;
}

const lineCols = (
  l: L,
  total: string,
  totalValue: number,
): readonly Column<Line>[] => [
  {
    key: "label",
    header: l("Detail", "ब्योरा", "Detail"),
    cell: (x) => x.label,
    primary: true,
    footer: total,
  },
  {
    key: "value",
    header: l("Amount", "रक़म", "Amount"),
    num: true,
    cell: (x) => money(x.value),
    footer: money(totalValue),
  },
];

export function SalesSection({ report }: { report: ReportData }) {
  const l = useL();
  const s = report.sales;
  const rows: Line[] = [
    { key: "upi", label: "UPI", value: s.upiPaise },
    {
      key: "cash",
      label: l("Cash and card", "कैश और कार्ड", "Cash aur card"),
      value: s.cashPaise,
    },
  ];
  const change =
    s.changePct === null
      ? l(
          "No data for the previous period.",
          "पिछली अवधि का डेटा नहीं है।",
          "Pichhle period ka data nahi hai.",
        )
      : l(
          `${Math.abs(s.changePct)}% ${s.changePct < 0 ? "lower" : "higher"} than the previous period (${rupees(s.prevTotalPaise)}).`,
          `पिछली अवधि (${rupees(s.prevTotalPaise)}) से ${Math.abs(s.changePct)}% ${s.changePct < 0 ? "कम" : "ज़्यादा"}।`,
          `Pichhle period (${rupees(s.prevTotalPaise)}) se ${Math.abs(s.changePct)}% ${s.changePct < 0 ? "kam" : "zyada"}.`,
        );
  return (
    <Section
      id="rp-sales"
      title={l("Sales", "बिक्री", "Sales (bikri)")}
      note={
        <>
          {num(s.bills)}{" "}
          {l("bills, average bill", "बिल, औसत बिल", "bills, average bill")}{" "}
          <span className="num">{rupees(s.avgBillPaise)}</span>.{" "}
          {l("Refunds of", "रिफंड", "Refund")}{" "}
          <span className="num">{rupees(s.refundsPaise)}</span>{" "}
          {l(
            "are already deducted from the total above.",
            "ऊपर के जोड़ में से पहले ही कटे हुए हैं।",
            "upar ke jod mein se pehle hi kata hua hai.",
          )}{" "}
          {change}
        </>
      }
    >
      {s.bills === 0 && s.totalPaise === 0 ? (
        none(
          l(
            "No sales in this period.",
            "इस अवधि में कोई बिक्री नहीं।",
            "Is period mein koi bikri nahi.",
          ),
        )
      ) : (
        <DataTable
          caption={l(
            "Sales by payment method",
            "भुगतान के तरीके के हिसाब से बिक्री",
            "Sales method ke hisaab se",
          )}
          columns={lineCols(
            l,
            l("Total sales", "कुल बिक्री", "Kul sales"),
            s.totalPaise,
          )}
          rows={rows}
          rowKey={(x) => x.key}
          dense
        />
      )}
    </Section>
  );
}

export function ProfitSection({ report }: { report: ReportData }) {
  const l = useL();
  const p = report.profit;
  const rows: Line[] = [
    {
      key: "gross",
      label: l(
        "Gross profit (sales minus cost of goods)",
        "कुल मुनाफ़ा (बिक्री घटा माल की लागत)",
        "Gross munafa (bikri minus maal ki laagat)",
      ),
      value: p.grossPaise,
    },
    {
      key: "exp",
      label: l("Expenses", "ख़र्चा", "Kharcha"),
      value: -p.expensesPaise,
    },
  ];
  return (
    <Section id="rp-profit" title={l("Profit", "मुनाफ़ा", "Profit (munafa)")}>
      <DataTable
        caption={l(
          "Net profit: gross profit minus expenses",
          "शुद्ध मुनाफ़ा: कुल मुनाफ़ा घटा ख़र्चा",
          "Gross munafa se kharcha ghata kar net munafa",
        )}
        columns={lineCols(
          l,
          l("Net profit", "शुद्ध मुनाफ़ा", "Net munafa"),
          p.netPaise,
        )}
        rows={rows}
        rowKey={(x) => x.key}
        dense
      />
    </Section>
  );
}

const topCols = (
  l: L,
  items: readonly TopItem[],
): readonly Column<TopItem>[] => [
  {
    key: "name",
    header: l("Item", "आइटम", "Item"),
    cell: (t) => t.name,
    primary: true,
    footer: l(
      `Total of top ${num(items.length)}`,
      `ऊपर के ${num(items.length)} का जोड़`,
      `Upar ke ${num(items.length)} ka jod`,
    ),
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
    footer: rupees(sum(items.map((t) => t.revenuePaise))),
  },
  {
    key: "profit",
    header: l("Profit", "मुनाफ़ा", "Munafa"),
    num: true,
    cell: (t) => money(t.profitPaise),
    footer: money(sum(items.map((t) => t.profitPaise))),
  },
];

export function TopSection({ report }: { report: ReportData }) {
  const l = useL();
  const { topByRevenue: rev, topByProfit: prof } = report;
  return (
    <Section
      id="rp-top"
      title={l("Top products", "सबसे ज़्यादा बिकने वाले प्रोडक्ट", "Top products")}
    >
      {rev.length === 0 ? (
        none(
          l(
            "No item sold in this period.",
            "इस अवधि में कोई आइटम नहीं बिका।",
            "Is period mein koi item nahi bika.",
          ),
        )
      ) : (
        <>
          <DataTable
            caption={l(
              "Top items by sales",
              "बिक्री के हिसाब से टॉप आइटम",
              "Sales ke hisaab se top items",
            )}
            columns={topCols(l, rev)}
            rows={rev}
            rowKey={(t) => `r-${t.productId}`}
            dense
          />
          <h4 className="rp-sub">
            {l("By profit", "मुनाफ़े के हिसाब से", "Munafa ke hisaab se")}
          </h4>
          <DataTable
            caption={l(
              "Top items by profit",
              "मुनाफ़े के हिसाब से टॉप आइटम",
              "Munafa ke hisaab se top items",
            )}
            columns={topCols(l, prof)}
            rows={prof}
            rowKey={(t) => `p-${t.productId}`}
            dense
          />
        </>
      )}
    </Section>
  );
}

export function LostSection({ report }: { report: ReportData }) {
  const l = useL();
  const lost = report.lostSales;
  return (
    <Section
      id="rp-lost"
      title={l("Lost sales", "छूटी हुई बिक्री", "Lost sales (gayi hui bikri)")}
      note={l(
        "A customer asked for the item but it was out of stock, or it did not match.",
        "ग्राहक ने आइटम माँगा पर स्टॉक में नहीं था, या मेल नहीं खाया।",
        "Customer ne maanga par item stock mein nahi tha, ya match nahi hua.",
      )}
    >
      {lost.requests === 0 ? (
        none(
          l(
            "No request was missed in this period.",
            "इस अवधि में कोई माँग नहीं छूटी।",
            "Is period mein koi maang chhooti nahi.",
          ),
        )
      ) : (
        <Table
          caption={l("Lost sales", "छूटी हुई बिक्री", "Gayi hui bikri")}
          dense
        >
          <thead>
            <tr>
              <th scope="col">{l("Detail", "ब्योरा", "Detail")}</th>
              <th scope="col" className="num">
                {l("Requests", "माँग", "Maang")}
              </th>
            </tr>
          </thead>
          <tbody>
            {lost.top ? (
              <tr>
                <td data-label={l("Detail", "ब्योरा", "Detail")}>
                  {l(
                    "Most requested",
                    "सबसे ज़्यादा माँगा गया",
                    "Sabse zyada maanga gaya",
                  )}
                  : {lost.top.name}
                </td>
                <td className="num" data-label={l("Requests", "माँग", "Maang")}>
                  {num(lost.top.requests)}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td data-label={l("Detail", "ब्योरा", "Detail")}>
                {l(
                  `Total requests ${num(lost.requests)}, sales lost`,
                  `कुल माँग ${num(lost.requests)}, छूटी बिक्री`,
                  `Kul maang ${num(lost.requests)}, gayi hui bikri`,
                )}
              </td>
              <td className="num" data-label={l("Requests", "माँग", "Maang")}>
                {rupees(lost.totalPaise)}
              </td>
            </tr>
          </tfoot>
        </Table>
      )}
    </Section>
  );
}

type KhataRow = ReportData["khata"]["red"][number];
type PayRow = ReportData["payablesDue"][number];

export function KhataPayablesSection({ report }: { report: ReportData }) {
  const l = useL();
  const { khata, payablesDue: pay } = report;
  const khataCols: readonly Column<KhataRow>[] = [
    {
      key: "who",
      header: l("Customer", "ग्राहक", "Customer"),
      cell: (a) => a.name,
      primary: true,
      footer: l("Total in the red", "लाल में कुल", "Red mein ka jod"),
    },
    {
      key: "old",
      header: l("Oldest", "सबसे पुराना", "Sabse purana"),
      num: true,
      cell: (a) => `${num(a.oldestUnpaidDays)} ${dayWord(l)}`,
    },
    {
      key: "due",
      header: l("Due", "बाक़ी", "Baaki"),
      num: true,
      cell: (a) => rupees(a.outstandingPaise),
      footer: rupees(sum(khata.red.map((a) => a.outstandingPaise))),
    },
  ];
  const payCols: readonly Column<PayRow>[] = [
    {
      key: "vendor",
      header: l("Supplier", "सप्लायर", "Supplier"),
      cell: (p) => `${p.vendorName}${p.invoiceNo ? `, ${p.invoiceNo}` : ""}`,
      primary: true,
      footer: l("Total due", "कुल देय", "Due ka jod"),
    },
    {
      key: "date",
      header: l("Due date", "देय तारीख़", "Due date"),
      cell: (p) => (p.dueDate ? shortDay(p.dueDate.slice(0, 10)) : ""),
    },
    {
      key: "in",
      header: l("How many days", "कितने दिन", "Kitne din"),
      cell: (p) =>
        p.dueInDays < 0 ? (
          <Badge tone="danger">
            {l(
              `${-p.dueInDays} days late`,
              `${-p.dueInDays} दिन लेट`,
              `${-p.dueInDays} din late`,
            )}
          </Badge>
        ) : p.dueInDays === 0 ? (
          <Badge tone="warn">{l("Today", "आज", "Aaj")}</Badge>
        ) : (
          `${Math.round(p.dueInDays)} ${dayWord(l)}`
        ),
    },
    {
      key: "amt",
      header: l("Amount", "रक़म", "Amount"),
      num: true,
      cell: (p) => rupees(p.amountPaise),
      footer: rupees(sum(pay.map((p) => p.amountPaise))),
    },
  ];
  return (
    <Section
      id="rp-khata"
      title={l(
        "Khata and supplier payments",
        "खाता और सप्लायर पेमेंट",
        "Khata aur supplier payments",
      )}
      note={
        <>
          {l("Total due in khata", "खाते में कुल बाक़ी", "Khata mein kul baaki")}{" "}
          <span className="num">{rupees(khata.totalDuePaise)}</span>,{" "}
          {l("collected this period", "इस अवधि में वसूल", "is period mein wasool")}{" "}
          <span className="num">{rupees(khata.collectedPaise)}</span>.
        </>
      }
    >
      {khata.red.length === 0 ? (
        none(
          l(
            "No customer is in the red.",
            "कोई ग्राहक लाल में नहीं।",
            "Koi customer red mein nahi.",
          ),
        )
      ) : (
        <DataTable
          caption={l("Khata in the red", "लाल में खाता", "Red mein khata")}
          columns={khataCols}
          rows={khata.red}
          rowKey={(a) => a.customerId}
          dense
        />
      )}
      <h4 className="rp-sub">
        {l("Supplier payments", "सप्लायर पेमेंट", "Supplier payments")}
      </h4>
      {pay.length === 0 ? (
        none(
          l(
            "No supplier payment is due.",
            "कोई सप्लायर पेमेंट बाक़ी नहीं।",
            "Koi supplier payment due nahi.",
          ),
        )
      ) : (
        <DataTable
          caption={l(
            "Supplier payments that are due",
            "जो सप्लायर पेमेंट बाक़ी हैं",
            "Supplier payments jo due hain",
          )}
          columns={payCols}
          rows={pay}
          rowKey={(p) => p.purchaseId}
          dense
        />
      )}
    </Section>
  );
}
