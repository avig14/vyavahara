"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { Badge, Button, EmptyState, ErrorState, Skeleton, Table } from "@/components/ui";
import { RefreshIcon } from "@/components/ui/icons";
import { num, rupees, rupeesExact } from "@/lib/format";
import { dayLabelWeekday, humanize, istTime, istTimeSeconds } from "@/lib/ui/ist-labels";
import { POLL_MS, useRozmel, type RozmelResponse, type RozmelRow } from "./use-rozmel";

const METHOD: Record<string, string> = { upi: "UPI", cash: "Cash", card: "Card" };
const methodLabel = (m: string) => METHOD[m] ?? humanize(m);

function itemsLine(row: RozmelRow): string {
  if (row.items.length === 0) return "";
  const names = row.items.slice(0, 3).map((i) => (i.qty > 1 ? `${i.name} x${num(i.qty)}` : i.name));
  const more = row.items.length - names.length;
  return more > 0 ? `${names.join(", ")} and ${more} more` : names.join(", ");
}

function Money({ paise, className }: { paise: number; className?: string }) {
  return <span className={paise < 0 ? `gr-neg ${className ?? ""}` : className}>{rupeesExact(paise)}</span>;
}

function Hero({ data }: { data: RozmelResponse }) {
  const lastSale = [...data.rows].reverse().find((r) => r.kind === "sale");
  return (
    <section className="sb-hero" aria-label="Last payment and today's total">
      <div className="sb-last">
        <p className="sb-label">Last payment received</p>
        {lastSale ? (
          <>
            <p className="sb-amount figure" aria-live="polite">
              {rupeesExact(lastSale.amountPaise)}
            </p>
            <p className="sb-meta">
              <span className="sb-meta-time">{istTime(lastSale.at)}</span>
              <span>{methodLabel(lastSale.method)}</span>
              {lastSale.payer ? <span>from {lastSale.payer}</span> : null}
            </p>
            {itemsLine(lastSale) ? <p className="sb-items">{itemsLine(lastSale)}</p> : null}
          </>
        ) : (
          <p className="sb-amount figure" aria-live="polite">
            None yet
          </p>
        )}
      </div>
      <div className="sb-total">
        <p className="sb-label">Today so far</p>
        <p className="sb-total-fig figure">{rupees(data.totalPaise)}</p>
        <p className="sb-label">
          {num(data.count)} {data.count === 1 ? "entry" : "entries"}
        </p>
      </div>
    </section>
  );
}

function Rozmel({ data }: { data: RozmelResponse }) {
  const rows = [...data.rows].reverse();
  return (
    <section className="sb-roz" aria-label="Rozmel, today's day-book">
      <div className="sb-roz-head">
        <h2>
          Rozmel <span className="deva sb-label" lang="hi">रोज़मेल</span>
        </h2>
        <p className="sb-label">{dayLabelWeekday(data.day)}, newest first</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No payments yet today" description="Each payment appears here the moment it is recorded." />
      ) : (
        <Table restack={false} caption={`Receipts on ${dayLabelWeekday(data.day)}, newest first, with the running total after each line`}>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Details</th>
              <th scope="col" className="num">
                Amount
              </th>
              <th scope="col" className="num sb-run-col">
                Running total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} data-newest={i === 0 ? "" : undefined}>
                <td>{istTime(r.at)}</td>
                <td>
                  {r.payer ?? "Walk-in"}
                  {r.kind === "refund" ? <> <Badge tone="danger">Refund</Badge></> : null}
                  <span className="sb-sub">{[methodLabel(r.method), itemsLine(r)].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="num">
                  <span className="sb-amt">
                    <Money paise={r.amountPaise} />
                  </span>
                  <span className="sb-sub sb-run-sub">Total {rupeesExact(r.runningTotalPaise)}</span>
                </td>
                <td className="num sb-run-col">{rupeesExact(r.runningTotalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}

export function SoundboxView() {
  const { data, error, loading, fetching, updatedAt, refresh } = useRozmel();
  const seconds = POLL_MS / 1000;

  return (
    <div className="sb">
      <header className="sb-bar">
        <span className="sb-mark">
          <LogoMark size={36} />
          <span className="sb-mark-latin">Vyavahāra</span>
          <span className="sb-mark-deva deva" lang="hi">
            व्यवहार
          </span>
        </span>
        <span className="sb-links">
          <Link href="/dashboard/soundbox" className="sb-talk">
            Soundbox se baat karein
          </Link>
          <Link href="/dashboard" className="sb-link">
            Open dashboard
          </Link>
        </span>
      </header>
      <main className="sb-main">
        <h1 className="visually-hidden">Soundbox counter</h1>

        {error && data ? (
          <div className="sb-warn" role="alert">
            <p>
              <strong>Not connected.</strong> {updatedAt ? `Showing what was true at ${istTimeSeconds(updatedAt)}. ` : ""}Trying again every {seconds} seconds.
            </p>
            <Button variant="secondary" icon={<RefreshIcon size={16} />} loading={fetching} onClick={refresh}>
              Try now
            </Button>
          </div>
        ) : null}

        {!data && loading ? (
          <>
            <Skeleton shape="block" height="9rem" label="Loading last payment" />
            <Skeleton shape="rows" count={6} cols={4} label="Loading rozmel" />
          </>
        ) : null}

        {!data && error ? <ErrorState title="Could not load today's payments" error={error} onRetry={refresh} retrying={fetching} /> : null}

        {data ? (
          <>
            <Hero data={data} />
            <Rozmel data={data} />
            <p className="sb-conn">
              {error ? "Not connected." : `Live. Updated ${updatedAt ? istTimeSeconds(updatedAt) : ""}.`} Refreshes every {seconds} seconds while this tab is open.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
