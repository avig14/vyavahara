"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, Tabs, type BadgeTone, type Column, type TabItem } from "@/components/ui";
import type { CustomerSegment, Segment, SegmentOverview } from "@/lib/analytics/segments";
import type { AccountJson, KhataResponse } from "@/components/khata/types";
import { useApi, type ApiState } from "@/lib/ui/api";
import { daysAgo } from "@/lib/ui/date";
import { useQueryParams, useQueryState } from "@/lib/ui/url-state";
import { useSearchText } from "@/lib/ui/use-search-text";
import { rupees } from "@/lib/format";

type SegmentTab = Segment | "all";
const SEGMENT_IDS = ["all", "regular", "new", "lapsed", "occasional"] as const satisfies readonly SegmentTab[];

const SEGMENT: Record<Segment, { label: string; tone: BadgeTone; meaning: string }> = {
  regular: { label: "Regular", tone: "info", meaning: "Haal mein baar baar aaye." },
  new: { label: "Naya", tone: "neutral", meaning: "Haal hi mein pehli baar aaye." },
  lapsed: { label: "Aana band", tone: "warn", meaning: "Pehle baar baar aate the, ab nahi aa rahe." },
  occasional: { label: "Kabhi kabhi", tone: "neutral", meaning: "Kabhi kabhi aate hain." },
};

const SORTS = ["lifetime", "recent", "visits", "baaki"] as const;
type SortKey = (typeof SORTS)[number];
const SORT_OPTIONS = [
  { value: "lifetime", label: "Kul kharcha, zyada pehle" },
  { value: "recent", label: "Haal mein aaye pehle" },
  { value: "visits", label: "Zyada visit pehle" },
  { value: "baaki", label: "Zyada baaki pehle" },
];

const NO_ACCOUNTS: ReadonlyMap<string, AccountJson> = new Map();

export function CustomersView() {
  const seg = useApi<SegmentOverview>("/api/dashboard/customers");
  const khata = useApi<KhataResponse>("/api/dashboard/khata");

  const accounts = useMemo<ReadonlyMap<string, AccountJson>>(
    () => (khata.data ? new Map(khata.data.khata.accounts.map((a) => [a.customerId, a])) : NO_ACCOUNTS),
    [khata.data],
  );
  const counts = seg.data?.counts;
  const total = seg.data?.customers.length;

  const tabs: readonly TabItem<SegmentTab>[] = SEGMENT_IDS.map((id) => ({
    id,
    label: id === "all" ? (total === undefined ? "Sab" : `Sab (${total})`) : `${SEGMENT[id].label}${counts ? ` (${counts[id]})` : ""}`,
  }));

  return (
    <>
      <PageHeader
        title="Customers"
        hindi="ग्राहक"
        description={seg.data && counts ? `${total} naam wale customers. ${counts.lapsed} pehle regular the, ab nahi aa rahe.` : undefined}
      />
      <Tabs items={tabs} param="segment" defaultId="all" label="Customer ke type">
        {(active) => (
          <CustomerTable active={active} seg={seg} accounts={accounts} khataLoaded={Boolean(khata.data)} khataFailed={Boolean(khata.error) && !khata.data} retryKhata={khata.refetch} />
        )}
      </Tabs>
    </>
  );
}

interface TableProps {
  active: SegmentTab;
  seg: ApiState<SegmentOverview>;
  accounts: ReadonlyMap<string, AccountJson>;
  khataLoaded: boolean;
  khataFailed: boolean;
  retryKhata: () => void;
}

function CustomerTable({ active, seg, accounts, khataLoaded, khataFailed, retryKhata }: TableProps) {
  const { patch } = useQueryParams();
  const [sort, setSort] = useQueryState<SortKey>("sort", { defaultValue: "lifetime", allowed: SORTS });
  const [text, setText] = useSearchText("q");
  const needle = text.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!seg.data) return undefined;
    const baaki = (c: CustomerSegment) => accounts.get(c.customerId)?.outstandingPaise ?? 0;
    const order: Record<SortKey, (a: CustomerSegment, b: CustomerSegment) => number> = {
      lifetime: (a, b) => b.lifetimePaise - a.lifetimePaise,
      recent: (a, b) => (a.lastVisitDaysAgo ?? Infinity) - (b.lastVisitDaysAgo ?? Infinity),
      visits: (a, b) => b.visits30 - a.visits30 || b.lifetimePaise - a.lifetimePaise,
      baaki: (a, b) => baaki(b) - baaki(a) || b.lifetimePaise - a.lifetimePaise,
    };
    return seg.data.customers
      .filter((c) => (active === "all" || c.segment === active) && (!needle || c.name.toLowerCase().includes(needle)))
      .sort(order[sort]);
  }, [seg.data, accounts, active, needle, sort]);

  const columns: readonly Column<CustomerSegment>[] = [
    { key: "name", header: "Customer", primary: true, cell: (c) => c.name },
    { key: "segment", header: "Type", cell: (c) => <Badge tone={SEGMENT[c.segment].tone}>{SEGMENT[c.segment].label}</Badge> },
    { key: "visits", header: "Visit (30 din)", num: true, cell: (c) => c.visits30 },
    { key: "last", header: "Aakhri visit", cell: (c) => (c.lastVisitDaysAgo === null ? "" : daysAgo(c.lastVisitDaysAgo)) },
    { key: "spend30", header: "Kharcha (30 din)", num: true, cell: (c) => rupees(c.spend30Paise) },
    { key: "lifetime", header: "Kul kharcha", num: true, cell: (c) => rupees(c.lifetimePaise) },
    {
      key: "baaki",
      header: "Baaki",
      num: true,
      cell: (c) => {
        const a = accounts.get(c.customerId);
        if (a) {
          return (
            <Link href={`/dashboard/khata?customer=${encodeURIComponent(c.customerId)}`} aria-label={`${c.name} ka khata kholo, baaki ${rupees(a.outstandingPaise)}`}>
              {rupees(a.outstandingPaise)}
            </Link>
          );
        }
        return <span className="kh-quiet">{khataLoaded ? "Nahi" : "-"}</span>;
      },
    },
    {
      key: "blocked",
      header: "Udhaar",
      cell: (c) => {
        const a = accounts.get(c.customerId);
        if (!a) return <span className="kh-quiet">-</span>;
        return a.creditBlocked ? <Badge tone="danger">Band</Badge> : <span className="kh-quiet">Chalu</span>;
      },
    },
  ];

  function clearFilters() {
    setText("");
    patch({ q: null, segment: null });
  }

  return (
    <section className="cu-panel" aria-label="Customer list">
      {active !== "all" ? <p className="cu-meaning">{SEGMENT[active].meaning}</p> : null}
      <div className="kh-filters" role="search">
        <Field label="Naam dhundho">
          <Input type="search" name="q" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder="Jaise Ramesh" />
        </Field>
        <Field label="Kaise sajayein">
          <Select name="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} options={SORT_OPTIONS} />
        </Field>
      </div>

      {seg.error && !seg.data ? (
        <ErrorState title="Customer list nahi aayi" error={seg.error} onRetry={seg.refetch} retrying={seg.loading} />
      ) : !rows ? (
        <Skeleton shape="rows" count={8} cols={5} label="Customers load ho rahe hain" />
      ) : (
        <>
          <DataTable
            caption="Customers, unki visit aur kharcha"
            columns={columns}
            rows={rows}
            rowKey={(c) => c.customerId}
            dense
            empty={
              <EmptyState
                title="Kuch nahi mila"
                description={needle ? "Is naam ka koi customer is type mein nahi hai." : "Is type mein abhi koi customer nahi hai."}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Filter hatao
                  </Button>
                }
              />
            }
          />
          {khataFailed ? (
            <p className="cu-note" role="alert">
              Baaki ka data nahi aaya.{" "}
              <button type="button" className="cu-link" onClick={retryKhata}>
                Dobara try karo
              </button>
            </p>
          ) : (
            <p className="cu-note">Udhaar chalu ya band sirf unka dikhta hai jinka baaki hai.</p>
          )}
        </>
      )}
    </section>
  );
}
