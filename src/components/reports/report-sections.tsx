"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, Table, type Column } from "@/components/ui/table";
import { daysLabel, num, rupees } from "@/lib/format";
import type { ReportData, TopItem } from "@/lib/reports/build";
import { shortDay } from "@/lib/ui/dates";
import { qty } from "@/components/overview/lines";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const money = (p: number) => <span className={p < 0 ? "rp-neg" : undefined}>{rupees(p)}</span>;

function Section({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
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

const LINE_COLS = (total: string, totalValue: number): readonly Column<Line>[] => [
  { key: "label", header: "Detail", cell: (l) => l.label, primary: true, footer: total },
  { key: "value", header: "Amount", num: true, cell: (l) => money(l.value), footer: money(totalValue) },
];

export function SalesSection({ report }: { report: ReportData }) {
  const s = report.sales;
  const rows: Line[] = [
    { key: "upi", label: "UPI", value: s.upiPaise },
    { key: "cash", label: "Cash aur card", value: s.cashPaise },
  ];
  return (
    <Section
      id="rp-sales"
      title="Sales (bikri)"
      note={
        <>
          {num(s.bills)} bills, average bill <span className="num">{rupees(s.avgBillPaise)}</span>. Refund <span className="num">{rupees(s.refundsPaise)}</span> upar ke jod mein se pehle hi kata hua hai.{" "}
          {s.changePct === null ? "Pichhle period ka data nahi hai." : `Pichhle period (${rupees(s.prevTotalPaise)}) se ${Math.abs(s.changePct)}% ${s.changePct < 0 ? "kam" : "zyada"}.`}
        </>
      }
    >
      {s.bills === 0 && s.totalPaise === 0 ? none("Is period mein koi bikri nahi.") : <DataTable caption="Sales method ke hisaab se" columns={LINE_COLS("Kul sales", s.totalPaise)} rows={rows} rowKey={(l) => l.key} dense />}
    </Section>
  );
}

export function ProfitSection({ report }: { report: ReportData }) {
  const p = report.profit;
  const rows: Line[] = [
    { key: "gross", label: "Gross munafa (bikri minus maal ki laagat)", value: p.grossPaise },
    { key: "exp", label: "Kharcha", value: -p.expensesPaise },
  ];
  return (
    <Section id="rp-profit" title="Profit (munafa)">
      <DataTable caption="Gross munafa se kharcha ghata kar net munafa" columns={LINE_COLS("Net munafa", p.netPaise)} rows={rows} rowKey={(l) => l.key} dense />
    </Section>
  );
}

const TOP_COLS = (items: readonly TopItem[]): readonly Column<TopItem>[] => [
  { key: "name", header: "Item", cell: (t) => t.name, primary: true, footer: `Upar ke ${num(items.length)} ka jod` },
  { key: "qty", header: "Bika", num: true, cell: (t) => `${qty(t.qty)} ${t.unit}`.trim() },
  { key: "rev", header: "Sales", num: true, cell: (t) => rupees(t.revenuePaise), footer: rupees(sum(items.map((t) => t.revenuePaise))) },
  { key: "profit", header: "Munafa", num: true, cell: (t) => money(t.profitPaise), footer: money(sum(items.map((t) => t.profitPaise))) },
];

export function TopSection({ report }: { report: ReportData }) {
  const { topByRevenue: rev, topByProfit: prof } = report;
  return (
    <Section id="rp-top" title="Top products">
      {rev.length === 0 ? (
        none("Is period mein koi item nahi bika.")
      ) : (
        <>
          <DataTable caption="Sales ke hisaab se top items" columns={TOP_COLS(rev)} rows={rev} rowKey={(t) => `r-${t.productId}`} dense />
          <h4 className="rp-sub">Munafa ke hisaab se</h4>
          <DataTable caption="Munafa ke hisaab se top items" columns={TOP_COLS(prof)} rows={prof} rowKey={(t) => `p-${t.productId}`} dense />
        </>
      )}
    </Section>
  );
}

export function LostSection({ report }: { report: ReportData }) {
  const l = report.lostSales;
  return (
    <Section id="rp-lost" title="Lost sales (gayi hui bikri)" note="Customer ne maanga par item stock mein nahi tha, ya match nahi hua.">
      {l.requests === 0 ? (
        none("Is period mein koi maang chhooti nahi.")
      ) : (
        <Table caption="Gayi hui bikri" dense>
          <thead>
            <tr>
              <th scope="col">Detail</th>
              <th scope="col" className="num">
                Maang
              </th>
            </tr>
          </thead>
          <tbody>
            {l.top ? (
              <tr>
                <td data-label="Detail">Sabse zyada maanga gaya: {l.top.name}</td>
                <td className="num" data-label="Maang">
                  {num(l.top.requests)}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td data-label="Detail">Kul maang {num(l.requests)}, gayi hui bikri</td>
              <td className="num" data-label="Maang">
                {rupees(l.totalPaise)}
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
  const { khata, payablesDue: pay } = report;
  const khataCols: readonly Column<KhataRow>[] = [
    { key: "who", header: "Customer", cell: (a) => a.name, primary: true, footer: "Red mein ka jod" },
    { key: "old", header: "Sabse purana", num: true, cell: (a) => `${num(a.oldestUnpaidDays)} din` },
    { key: "due", header: "Baaki", num: true, cell: (a) => rupees(a.outstandingPaise), footer: rupees(sum(khata.red.map((a) => a.outstandingPaise))) },
  ];
  const payCols: readonly Column<PayRow>[] = [
    { key: "vendor", header: "Supplier", cell: (p) => `${p.vendorName}${p.invoiceNo ? `, ${p.invoiceNo}` : ""}`, primary: true, footer: "Due ka jod" },
    { key: "date", header: "Due date", cell: (p) => (p.dueDate ? shortDay(p.dueDate.slice(0, 10)) : "") },
    {
      key: "in",
      header: "Kitne din",
      cell: (p) => (p.dueInDays < 0 ? <Badge tone="danger">{-p.dueInDays} din late</Badge> : p.dueInDays === 0 ? <Badge tone="warn">Aaj</Badge> : daysLabel(p.dueInDays)),
    },
    { key: "amt", header: "Amount", num: true, cell: (p) => rupees(p.amountPaise), footer: rupees(sum(pay.map((p) => p.amountPaise))) },
  ];
  return (
    <Section
      id="rp-khata"
      title="Khata aur supplier payments"
      note={
        <>
          Khata mein kul baaki <span className="num">{rupees(khata.totalDuePaise)}</span>, is period mein wasool <span className="num">{rupees(khata.collectedPaise)}</span>.
        </>
      }
    >
      {khata.red.length === 0 ? none("Koi customer red mein nahi.") : <DataTable caption="Red mein khata" columns={khataCols} rows={khata.red} rowKey={(a) => a.customerId} dense />}
      <h4 className="rp-sub">Supplier payments</h4>
      {pay.length === 0 ? none("Koi supplier payment due nahi.") : <DataTable caption="Supplier payments jo due hain" columns={payCols} rows={pay} rowKey={(p) => p.purchaseId} dense />}
    </Section>
  );
}
