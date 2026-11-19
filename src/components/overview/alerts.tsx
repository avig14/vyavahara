"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Column } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { daysLabel, num, rupees } from "@/lib/format";
import type { ReportData } from "@/lib/reports/build";
import type { ApiState } from "@/lib/ui/api";
import { Region } from "./region";
import type { OverviewPayload } from "./types";

type StockRow = ReportData["stockAlerts"]["out"][number];
type KhataRow = ReportData["khata"]["red"][number];
type PayRow = ReportData["payablesDue"][number];

function Block({ id, title, href, linkLabel, children }: { id: string; title: string; href?: string; linkLabel?: string; children: ReactNode }) {
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

const STOCK_COLS: readonly Column<StockRow>[] = [
  { key: "item", header: "Item", cell: (f) => f.name, primary: true },
  { key: "left", header: "Bacha", num: true, cell: (f) => num(f.stock, 1) },
  { key: "st", header: "Status", cell: (f) => (f.status === "stockout" ? <Badge tone="danger">Khatam</Badge> : <Badge tone="warn">{daysLabel(f.daysToStockout)} ka stock</Badge>) },
];

const KHATA_COLS: readonly Column<KhataRow>[] = [
  { key: "who", header: "Customer", cell: (a) => a.name, primary: true },
  { key: "old", header: "Sabse purana", num: true, cell: (a) => `${num(a.oldestUnpaidDays)} din` },
  { key: "due", header: "Baaki", num: true, cell: (a) => <span className="ov-due">{rupees(a.outstandingPaise)}</span> },
];

function dueBadge(p: PayRow) {
  if (p.dueInDays < 0) return <Badge tone="danger">{-p.dueInDays} din late</Badge>;
  if (p.dueInDays === 0) return <Badge tone="warn">Aaj</Badge>;
  return <Badge tone="neutral">{p.dueInDays} din mein</Badge>;
}

const PAY_COLS: readonly Column<PayRow>[] = [
  { key: "vendor", header: "Supplier", cell: (p) => p.vendorName, primary: true },
  { key: "due", header: "Due", cell: dueBadge },
  { key: "amt", header: "Amount", num: true, cell: (p) => rupees(p.amountPaise) },
];

const none = (text: string) => <p className="ov-none">{text}</p>;

function Body({ report }: { report: ReportData }) {
  const stock = [...report.stockAlerts.out, ...report.stockAlerts.runningOut];
  const dead = report.stockAlerts.dead;
  const lost = report.lostSales;
  const { khata, payablesDue, anomalies } = report;
  const nothing = stock.length === 0 && dead.length === 0 && lost.requests === 0 && khata.red.length === 0 && payablesDue.length === 0 && anomalies.length === 0;

  if (nothing) return <EmptyState title="Sab theek hai" description="Koi item khatam nahi, koi udhaar red mein nahi, koi vendor payment pending nahi." />;

  return (
    <div className="ov-blks">
      <Block id="al-stock" title="Stock" href="/dashboard/inventory" linkLabel="Poora stock">
        {stock.length ? <DataTable caption="Khatam ya jaldi khatam hone wale item" columns={STOCK_COLS} rows={stock} rowKey={(f) => f.productId} dense /> : none("Koi item khatam ya kam nahi.")}
        {dead.length ? (
          <p className="ov-line">
            Nahi bik raha: {dead.map((f) => f.name).join(", ")} ({num(dead.length)} item)
          </p>
        ) : null}
        {lost.requests > 0 ? (
          <p className="ov-line">
            Customers ne maanga par stock mein nahi tha: {lost.top ? `${lost.top.name}, ` : ""}
            {num(lost.requests)} baar. Gayi hui bikri {rupees(lost.totalPaise)}.
          </p>
        ) : null}
      </Block>

      <Block id="al-khata" title="Khata, red mein" href="/dashboard/khata" linkLabel="Poora khata">
        {khata.red.length ? <DataTable caption="Red mein khata wale customers" columns={KHATA_COLS} rows={khata.red} rowKey={(a) => a.customerId} dense /> : none("Koi customer red mein nahi.")}
        <p className="ov-line">
          Kul baaki <span className="num">{rupees(khata.totalDuePaise)}</span>, is period mein wasool <span className="num">{rupees(khata.collectedPaise)}</span>.
        </p>
      </Block>

      <Block id="al-pay" title="Supplier payments due" href="/dashboard/vendors" linkLabel="Saare suppliers">
        {payablesDue.length ? <DataTable caption="Supplier payments jo due hain" columns={PAY_COLS} rows={payablesDue} rowKey={(p) => p.purchaseId} dense /> : none("Koi payment due nahi.")}
      </Block>

      <Block id="al-odd" title="Kuch alag dikha">
        {anomalies.length ? (
          <ul className="ov-odd">
            {anomalies.map((a, i) => (
              <li key={`${a.kind}-${i}`}>
                {a.text}
                {a.kind === "item_drop" ? (
                  <>
                    {" "}
                    <Link href="/dashboard/inventory" className="ov-link">
                      Stock dekho
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          none("Koi alag baat nahi dikhi.")
        )}
      </Block>
    </div>
  );
}

/** Everything that needs a decision: stock, khata, supplier bills, odd days. Each block links to its page. */
export function Alerts({ state }: { state: ApiState<OverviewPayload> }) {
  return (
    <section aria-labelledby="alerts-h" className="ov-sec">
      <div className="ov-head">
        <h2 id="alerts-h">Dhyaan do</h2>
      </div>
      <Region state={state} errorTitle="Alerts nahi khul paye" skeleton={<Skeleton shape="rows" count={6} cols={3} label="Alerts load ho rahe hain" />}>
        {(d) => <Body report={d.report} />}
      </Region>
    </section>
  );
}
