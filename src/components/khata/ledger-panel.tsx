"use client";

import { PaymentQuick } from "./payment-quick";
import { useEffect, useMemo, useRef } from "react";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Skeleton,
  Stat,
  Stats,
  type Column,
} from "@/components/ui";
import { useApi } from "@/lib/ui/api";
import { istDate } from "@/lib/ui/date";
import { rupees } from "@/lib/format";
import { PayLinkMaker } from "./pay-link-maker";
import { riskMeta } from "./risk";
import { reasonText } from "@/lib/ui/api-text";
import { useL, type L } from "@/lib/ui/lang";
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
function toRows(
  entries: EntryJson[],
  outstandingPaise: number,
  l: L,
): LedgerRow[] {
  const asc = [...entries].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const net = asc.reduce(
    (s, e) => s + (e.type === "credit" ? e.amountPaise : -e.amountPaise),
    0,
  );
  const opening = outstandingPaise - net;
  let balance = opening;
  const rows: LedgerRow[] = asc.map((e) => {
    balance += e.type === "credit" ? e.amountPaise : -e.amountPaise;
    return {
      id: e.id,
      at: e.createdAt,
      note:
        e.note ??
        (e.type === "credit"
          ? l("Credit", "उधार", l("Credit", "उधार", "Udhaar"))
          : l("Payment", "पेमेंट", "Payment")),
      creditPaise: e.type === "credit" ? e.amountPaise : null,
      paymentPaise: e.type === "payment" ? e.amountPaise : null,
      balancePaise: balance,
    };
  });
  rows.reverse();
  if (opening !== 0)
    rows.push({
      id: "carried",
      at: null,
      note: l(
        "Balance from earlier entries",
        "पहले की एंट्री का बाक़ी",
        "Pehle ki entries ka baaki",
      ),
      creditPaise: null,
      paymentPaise: null,
      balancePaise: opening,
    });
  return rows;
}

const columns = (l: L): readonly Column<LedgerRow>[] => [
  {
    key: "at",
    header: l("Date", "तारीख़", "Tarikh"),
    cell: (r) => (r.at ? istDate(r.at) : l("Earlier", "पहले का", "Pehle ka")),
    width: "7rem",
  },
  { key: "note", header: l("Note", "नोट", "Note"), cell: (r) => r.note },
  {
    key: "credit",
    header: "Udhaar",
    num: true,
    cell: (r) =>
      r.creditPaise === null ? (
        ""
      ) : (
        <span className="kh-out">{rupees(r.creditPaise)}</span>
      ),
  },
  {
    key: "payment",
    header: l("Received", "जमा", "Jama"),
    num: true,
    cell: (r) =>
      r.paymentPaise === null ? (
        ""
      ) : (
        <span className="kh-in">{rupees(r.paymentPaise)}</span>
      ),
  },
  {
    key: "balance",
    header: l("Balance", "बाक़ी", "Baaki"),
    num: true,
    cell: (r) => <strong>{rupees(r.balancePaise)}</strong>,
  },
];

export interface LedgerPanelProps {
  customerId: string;
  onClose: () => void;
  /** after a payment is saved, so the list above can refresh too */
  onChanged?: () => void;
}

export function LedgerPanel({
  customerId,
  onClose,
  onChanged,
}: LedgerPanelProps) {
  const { data, error, loading, refetch } = useApi<LedgerResponse>(
    `/api/dashboard/khata?customerId=${encodeURIComponent(customerId)}`,
  );
  const l = useL();
  const RISK = riskMeta(l);
  const ref = useRef<HTMLElement>(null);
  const shown = data && data.customer.id === customerId ? data : undefined;

  // a customer was picked: bring the ledger into view and give it focus so keyboard and screen-reader users land on it
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest" });
  }, [customerId]);

  const rows = useMemo(
    () =>
      shown
        ? toRows(shown.ledger, shown.account?.outstandingPaise ?? 0, l)
        : undefined,
    [shown, l],
  );

  const customer = shown?.customer;
  const account = shown?.account ?? null;

  return (
    <section
      ref={ref}
      tabIndex={-1}
      className="kh-ledger"
      aria-labelledby="kh-ledger-title"
    >
      <header className="kh-ledger-head">
        <div className="kh-ledger-title">
          <h2 id="kh-ledger-title">
            {customer
              ? l(
                  `${customer.name}'s khata`,
                  `${customer.name} का खाता`,
                  `${customer.name} ka khata`,
                )
              : l("Opening khata", "खाता खुल रहा है", "Khata khul raha hai")}
          </h2>
          {account ? (
            <Badge tone={RISK[account.band].tone}>
              {RISK[account.band].label}
            </Badge>
          ) : null}
          {customer?.creditBlocked ? (
            <Badge tone="danger">
              {l("Credit blocked", "उधार बंद", "Udhaar band")}
            </Badge>
          ) : null}
        </div>
        <Button variant="quiet" onClick={onClose}>
          {l("Close", "बंद करें", "Close")}
        </Button>
      </header>

      {error && !shown ? (
        <ErrorState
          title={l(
            "Could not open the khata",
            "खाता नहीं खुल पाया",
            "Khata nahi khul paya",
          )}
          error={error}
          onRetry={refetch}
          retrying={loading}
        />
      ) : !shown || !rows || !customer ? (
        <Skeleton
          shape="rows"
          count={5}
          cols={5}
          label={l(
            "Loading khata",
            "खाता लोड हो रहा है",
            "Khata load ho raha hai",
          )}
        />
      ) : (
        <>
          <Stats className="kh-ledger-figs">
            <Stat
              label={l("Due", "बाक़ी", "Baaki")}
              figure={rupees(account?.outstandingPaise ?? 0)}
              size="lg"
            />
            <Stat
              label={l("Credit limit", "उधार की सीमा", "Udhaar limit")}
              figure={
                customer.creditLimitPaise > 0
                  ? rupees(customer.creditLimitPaise)
                  : l("Not set", "तय नहीं", "Tay nahi")
              }
              note={
                account && customer.creditLimitPaise > 0
                  ? l(
                      `${Math.round(account.utilization * 100)}% used`,
                      `${Math.round(account.utilization * 100)}% इस्तेमाल हो चुका`,
                      `${Math.round(account.utilization * 100)}% use ho chuka`,
                    )
                  : undefined
              }
            />
            <Stat
              label={l("Oldest due", "सबसे पुराना बाक़ी", "Sabse purana baaki")}
              figure={account ? String(account.oldestUnpaidDays) : "0"}
              unit={l("days", "दिन", "din")}
            />
          </Stats>

          {account && account.reasons.length > 0 ? (
            <div className="kh-why">
              <h3>{l("Why the risk", "जोखिम क्यों है", "Risk kyun hai")}</h3>
              <ul>
                {account.reasons.map((r) => (
                  <li key={r}>{reasonText(r, l)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <PaymentQuick
            key={`pq-${customer.id}`}
            customerId={customer.id}
            name={customer.name}
            owedPaise={account?.outstandingPaise ?? 0}
            onSaved={() => {
              refetch();
              onChanged?.();
            }}
          />

          <PayLinkMaker
            key={customer.id}
            customerId={customer.id}
            name={customer.name}
            owedPaise={account?.outstandingPaise ?? 0}
          />

          <DataTable
            caption={l(
              `${customer.name}'s credit and payments, newest first`,
              `${customer.name} का उधार और जमा, नया ऊपर`,
              `${customer.name} ka udhaar aur jama, naya upar`,
            )}
            columns={columns(l)}
            rows={rows}
            rowKey={(r) => r.id}
            dense
            empty={
              <EmptyState
                icon="khata"
                title={l(
                  "No entries in this customer's khata",
                  "इस ग्राहक के खाते में कोई एंट्री नहीं",
                  "Is customer ke khate mein koi entry nahi",
                )}
                description={l(
                  "A line will appear here as soon as credit or a payment is written.",
                  "उधार या पेमेंट लिखते ही यहाँ लाइन बनेगी।",
                  "Udhaar ya payment likhte hi yahan line banegi.",
                )}
              />
            }
          />
          <p className="kh-foot">
            {l(
              `To block or allow credit, tell Saathi: “${customer.creditBlocked ? "allow" : "block"} credit for ${customer.name}”.`,
              `उधार बंद या चालू करना हो तो साथी से कहें: “${customer.name} का उधार ${customer.creditBlocked ? "चालू" : "बंद"} करो”।`,
              `Udhaar band ya chalu karna ho to Saathi se bolo: “${customer.name} ka udhaar ${customer.creditBlocked ? "chalu" : "band"} karo”.`,
            )}
          </p>
        </>
      )}
    </section>
  );
}
