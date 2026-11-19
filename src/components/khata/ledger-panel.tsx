"use client";

import { useEffect, useMemo, useRef } from "react";
import { Badge, Button, DataTable, EmptyState, ErrorState, Skeleton, Stat, Stats, type Column } from "@/components/ui";
import { useApi } from "@/lib/ui/api";
import { istDate } from "@/lib/ui/date";
import { rupees } from "@/lib/format";
import { PayLinkMaker } from "./pay-link-maker";
import { RISK } from "./risk";
import type { EntryJson, LedgerResponse } from "./types";

interface LedgerRow {
  id: string;
  /** null for the carried-forward line */
  at: string | null;
  note: string;
  creditPaise: number | null;
  paymentPaise: number | null;
  balancePaise: number;
}

/**
 * Entries come newest first. Rebuild the running baaki oldest to newest; if the API's
 * entries do not add up to the current baaki (older entries are not returned), the gap
 * is shown as a carried-forward line at the bottom instead of being hidden.
 */
function toRows(entries: EntryJson[], outstandingPaise: number): LedgerRow[] {
  const asc = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const net = asc.reduce((s, e) => s + (e.type === "credit" ? e.amountPaise : -e.amountPaise), 0);
  const opening = outstandingPaise - net;
  let balance = opening;
  const rows: LedgerRow[] = asc.map((e) => {
    balance += e.type === "credit" ? e.amountPaise : -e.amountPaise;
    return {
      id: e.id,
      at: e.createdAt,
      note: e.note ?? (e.type === "credit" ? "Udhaar" : "Payment"),
      creditPaise: e.type === "credit" ? e.amountPaise : null,
      paymentPaise: e.type === "payment" ? e.amountPaise : null,
      balancePaise: balance,
    };
  });
  rows.reverse();
  if (opening !== 0) rows.push({ id: "carried", at: null, note: "Pehle ki entries ka baaki", creditPaise: null, paymentPaise: null, balancePaise: opening });
  return rows;
}

const COLUMNS: readonly Column<LedgerRow>[] = [
  { key: "at", header: "Tarikh", cell: (r) => (r.at ? istDate(r.at) : "Pehle ka"), width: "7rem" },
  { key: "note", header: "Note", cell: (r) => r.note },
  { key: "credit", header: "Udhaar", num: true, cell: (r) => (r.creditPaise === null ? "" : <span className="kh-out">{rupees(r.creditPaise)}</span>) },
  { key: "payment", header: "Jama", num: true, cell: (r) => (r.paymentPaise === null ? "" : <span className="kh-in">{rupees(r.paymentPaise)}</span>) },
  { key: "balance", header: "Baaki", num: true, cell: (r) => <strong>{rupees(r.balancePaise)}</strong> },
];

export interface LedgerPanelProps {
  customerId: string;
  onClose: () => void;
}

export function LedgerPanel({ customerId, onClose }: LedgerPanelProps) {
  const { data, error, loading, refetch } = useApi<LedgerResponse>(`/api/dashboard/khata?customerId=${encodeURIComponent(customerId)}`);
  const ref = useRef<HTMLElement>(null);
  const shown = data && data.customer.id === customerId ? data : undefined;

  // a customer was picked: bring the ledger into view and give it focus so keyboard and screen-reader users land on it
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest" });
  }, [customerId]);

  const rows = useMemo(() => (shown ? toRows(shown.ledger, shown.account?.outstandingPaise ?? 0) : undefined), [shown]);

  const customer = shown?.customer;
  const account = shown?.account ?? null;

  return (
    <section ref={ref} tabIndex={-1} className="kh-ledger" aria-labelledby="kh-ledger-title">
      <header className="kh-ledger-head">
        <div className="kh-ledger-title">
          <h2 id="kh-ledger-title">{customer ? `${customer.name} ka khata` : "Khata khul raha hai"}</h2>
          {account ? <Badge tone={RISK[account.band].tone}>{RISK[account.band].label}</Badge> : null}
          {customer?.creditBlocked ? <Badge tone="danger">Udhaar band</Badge> : null}
        </div>
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </header>

      {error && !shown ? (
        <ErrorState title="Khata nahi khul paya" error={error} onRetry={refetch} retrying={loading} />
      ) : !shown || !rows || !customer ? (
        <Skeleton shape="rows" count={5} cols={5} label="Khata load ho raha hai" />
      ) : (
        <>
          <Stats className="kh-ledger-figs">
            <Stat label="Baaki" figure={rupees(account?.outstandingPaise ?? 0)} size="lg" />
            <Stat
              label="Udhaar limit"
              figure={customer.creditLimitPaise > 0 ? rupees(customer.creditLimitPaise) : "Tay nahi"}
              note={account && customer.creditLimitPaise > 0 ? `${Math.round(account.utilization * 100)}% use ho chuka` : undefined}
            />
            <Stat label="Sabse purana baaki" figure={account ? String(account.oldestUnpaidDays) : "0"} unit="din" />
          </Stats>

          {account && account.reasons.length > 0 ? (
            <div className="kh-why">
              <h3>Risk kyun hai</h3>
              <ul>
                {account.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <PayLinkMaker key={customer.id} customerId={customer.id} name={customer.name} owedPaise={account?.outstandingPaise ?? 0} />

          <DataTable
            caption={`${customer.name} ka udhaar aur jama, naya upar`}
            columns={COLUMNS}
            rows={rows}
            rowKey={(r) => r.id}
            dense
            empty={<EmptyState title="Is customer ke khate mein koi entry nahi" description="Udhaar ya payment likhte hi yahan line banegi." />}
          />
          <p className="kh-foot">
            Udhaar band ya chalu karna ho to Saathi se bolo: &ldquo;{customer.name} ka udhaar {customer.creditBlocked ? "chalu" : "band"} karo&rdquo;.
          </p>
        </>
      )}
    </section>
  );
}
