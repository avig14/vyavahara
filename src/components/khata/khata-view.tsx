"use client";

import { useMemo } from "react";
import { Badge, Button, DataTable, EmptyState, Field, Input, PageHeader, Select, Skeleton, Stat, type Column } from "@/components/ui";
import { StackedBar } from "@/components/charts";
import { useApi } from "@/lib/ui/api";
import { istDate } from "@/lib/ui/date";
import { useQueryParams, useQueryState, useQueryString } from "@/lib/ui/url-state";
import { useSearchText } from "@/lib/ui/use-search-text";
import { rupees } from "@/lib/format";
import { LedgerPanel } from "./ledger-panel";
import { RISK } from "./risk";
import type { AccountJson, KhataResponse } from "./types";

const BANDS = ["all", "red", "amber", "green"] as const;
type BandFilter = (typeof BANDS)[number];
const SORTS = ["risk", "baaki", "purana"] as const;
type SortKey = (typeof SORTS)[number];

const BAND_OPTIONS = [
  { value: "all", label: "Sab" },
  { value: "red", label: RISK.red.label },
  { value: "amber", label: RISK.amber.label },
  { value: "green", label: RISK.green.label },
];
const SORT_OPTIONS = [
  { value: "risk", label: "Risk, zyada pehle" },
  { value: "baaki", label: "Baaki, zyada pehle" },
  { value: "purana", label: "Sabse purana pehle" },
];

function sorter(key: SortKey): (a: AccountJson, b: AccountJson) => number {
  if (key === "baaki") return (a, b) => b.outstandingPaise - a.outstandingPaise;
  if (key === "purana") return (a, b) => b.oldestUnpaidDays - a.oldestUnpaidDays;
  return (a, b) => b.score - a.score || b.outstandingPaise - a.outstandingPaise;
}

export function KhataView() {
  const { data, error, refetch } = useApi<KhataResponse>("/api/dashboard/khata");
  const { patch } = useQueryParams();
  const [customer, setCustomer] = useQueryString("customer");
  const [band, setBand] = useQueryState<BandFilter>("band", { defaultValue: "all", allowed: BANDS });
  const [sort, setSort] = useQueryState<SortKey>("sort", { defaultValue: "risk", allowed: SORTS });
  const [text, setText] = useSearchText("q");

  const khata = data?.khata;
  const needle = text.trim().toLowerCase();
  const filtered = Boolean(needle) || band !== "all";

  const rows = useMemo(() => {
    if (!khata) return undefined;
    return khata.accounts
      .filter((a) => (band === "all" || a.band === band) && (!needle || a.name.toLowerCase().includes(needle)))
      .sort(sorter(sort));
  }, [khata, band, needle, sort]);

  const shownTotal = rows?.reduce((s, a) => s + a.outstandingPaise, 0) ?? 0;

  const columns: readonly Column<AccountJson>[] = [
    { key: "name", header: "Customer", primary: true, cell: (a) => a.name, footer: filtered ? "Jo dikh rahe hain" : "Kul baaki" },
    { key: "baaki", header: "Baaki", num: true, cell: (a) => rupees(a.outstandingPaise), footer: rupees(shownTotal) },
    { key: "oldest", header: "Sabse purana", num: true, cell: (a) => `${a.oldestUnpaidDays} din` },
    { key: "risk", header: "Risk", cell: (a) => <Badge tone={RISK[a.band].tone}>{RISK[a.band].label}</Badge> },
    { key: "last", header: "Aakhri payment", cell: (a) => (a.lastPaymentAt ? istDate(a.lastPaymentAt) : <span className="kh-quiet">Koi payment nahi</span>) },
    { key: "blocked", header: "Udhaar", cell: (a) => (a.creditBlocked ? <Badge tone="danger">Band</Badge> : <span className="kh-quiet">Chalu</span>) },
  ];

  function clearFilters() {
    setText("");
    patch({ q: null, band: null });
  }

  return (
    <>
      <PageHeader
        title="Khata"
        hindi="खाता"
        description={khata ? `${khata.accounts.length} customers ka udhaar baaki hai. Naam par dabayein, poora hisaab khulega.` : undefined}
      />

      {error && !khata ? (
        <DataTable caption="Khata" columns={columns} rows={undefined} rowKey={(a) => a.customerId} error={error} onRetry={refetch} />
      ) : !khata ? (
        <Skeleton shape="rows" count={7} cols={5} label="Khata load ho raha hai" />
      ) : khata.accounts.length === 0 ? (
        <EmptyState title="Abhi kisi ka udhaar baaki nahi" description="Jab koi customer udhaar lega ya khata likha jayega, yahan baaki, risk aur purani date dikhegi." />
      ) : (
        <>
          <div className="kh-top">
            <div className="kh-figs">
              <Stat label="Kul baaki" figure={rupees(khata.totalOutstandingPaise)} size="lg" />
              <Stat label="Wapas aane ki ummeed" figure={rupees(khata.expectedRecoveryPaise)} note="Har customer ke risk ke hisaab se andaaza" />
            </div>
            <section aria-labelledby="kh-ageing" className="kh-ageing">
              <h2 id="kh-ageing">Baaki kitna purana hai</h2>
              <StackedBar
                format={rupees}
                summary={`Kul baaki ${rupees(khata.totalOutstandingPaise)}: 0 se 15 din ${rupees(khata.ageing.d0_15)}, 16 se 30 din ${rupees(khata.ageing.d16_30)}, 31 se 60 din ${rupees(khata.ageing.d31_60)}, 60 din se upar ${rupees(khata.ageing.d60p)}`}
                segments={[
                  { label: "0 se 15 din", value: khata.ageing.d0_15, tone: "s4" },
                  { label: "16 se 30 din", value: khata.ageing.d16_30, tone: "s3" },
                  { label: "31 se 60 din", value: khata.ageing.d31_60, tone: "warn" },
                  { label: "60 din se upar", value: khata.ageing.d60p, tone: "danger" },
                ]}
              />
            </section>
          </div>

          <section aria-labelledby="kh-list" className="kh-list">
            <h2 id="kh-list">Customer wise baaki</h2>
            <div className="kh-filters" role="search">
              <Field label="Naam dhundho">
                <Input type="search" name="q" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder="Jaise Suresh" />
              </Field>
              <Field label="Risk">
                <Select name="band" value={band} onChange={(e) => setBand(e.target.value as BandFilter)} options={BAND_OPTIONS} />
              </Field>
              <Field label="Kaise sajayein">
                <Select name="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} options={SORT_OPTIONS} />
              </Field>
            </div>
            <DataTable
              caption="Customers jinka udhaar baaki hai"
              columns={columns}
              rows={rows}
              rowKey={(a) => a.customerId}
              selectedKey={customer || null}
              onSelect={setCustomer}
              empty={
                <EmptyState
                  title="Kuch nahi mila"
                  description="Is naam ya risk ka koi customer baaki list mein nahi hai."
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      Filter hatao
                    </Button>
                  }
                />
              }
            />
          </section>

          {customer ? <LedgerPanel customerId={customer} onClose={() => setCustomer(null)} /> : null}
        </>
      )}
    </>
  );
}
