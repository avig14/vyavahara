"use client";

import Link from "next/link";
import { useL, type L } from "@/lib/ui/lang";
import { useMemo } from "react";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  type BadgeTone,
  type Column,
  type TabItem,
} from "@/components/ui";
import type {
  CustomerSegment,
  Segment,
  SegmentOverview,
} from "@/lib/analytics/segments";
import type { AccountJson, KhataResponse } from "@/components/khata/types";
import { useApi, type ApiState } from "@/lib/ui/api";
import { useQueryParams, useQueryState } from "@/lib/ui/url-state";
import { useSearchText } from "@/lib/ui/use-search-text";
import { rupees } from "@/lib/format";

type SegmentTab = Segment | "all";
const SEGMENT_IDS = [
  "all",
  "regular",
  "new",
  "lapsed",
  "occasional",
] as const satisfies readonly SegmentTab[];

const segmentMeta = (
  l: L,
): Record<Segment, { label: string; tone: BadgeTone; meaning: string }> => ({
  regular: {
    label: l("Regular", "नियमित", "Regular"),
    tone: "info",
    meaning: l(
      "Came often recently.",
      "हाल में बार-बार आए।",
      "Haal mein baar baar aaye.",
    ),
  },
  new: {
    label: l("New", "नया", "Naya"),
    tone: "neutral",
    meaning: l(
      "Came for the first time recently.",
      "हाल ही में पहली बार आए।",
      "Haal hi mein pehli baar aaye.",
    ),
  },
  lapsed: {
    label: l("Stopped coming", "आना बंद", "Aana band"),
    tone: "warn",
    meaning: l(
      "Used to come often, but not any more.",
      "पहले बार-बार आते थे, अब नहीं आ रहे।",
      "Pehle baar baar aate the, ab nahi aa rahe.",
    ),
  },
  occasional: {
    label: l("Occasional", "कभी-कभी", "Kabhi kabhi"),
    tone: "neutral",
    meaning: l(
      "Comes once in a while.",
      "कभी-कभी आते हैं।",
      "Kabhi kabhi aate hain.",
    ),
  },
});

const daysAgoL = (n: number, l: L) =>
  n <= 0
    ? l("Today", "आज", "Aaj")
    : n === 1
      ? l("Yesterday", "कल", "Kal")
      : l(`${n} days ago`, `${n} दिन पहले`, `${n} din pehle`);

const SORTS = ["lifetime", "recent", "visits", "baaki"] as const;
type SortKey = (typeof SORTS)[number];

const NO_ACCOUNTS: ReadonlyMap<string, AccountJson> = new Map();

export function CustomersView() {
  const l = useL();
  const SEGMENT = segmentMeta(l);
  const seg = useApi<SegmentOverview>("/api/dashboard/customers");
  const khata = useApi<KhataResponse>("/api/dashboard/khata");

  const accounts = useMemo<ReadonlyMap<string, AccountJson>>(
    () =>
      khata.data
        ? new Map(khata.data.khata.accounts.map((a) => [a.customerId, a]))
        : NO_ACCOUNTS,
    [khata.data],
  );
  const counts = seg.data?.counts;
  const total = seg.data?.customers.length;

  const tabs: readonly TabItem<SegmentTab>[] = SEGMENT_IDS.map((id) => ({
    id,
    label:
      id === "all"
        ? total === undefined
          ? l("All", "सब", "Sab")
          : `${l("All", "सब", "Sab")} (${total})`
        : `${SEGMENT[id].label}${counts ? ` (${counts[id]})` : ""}`,
  }));

  return (
    <>
      <PageHeader
        title="Customers"
        hindi="ग्राहक"
        description={
          seg.data && counts
            ? l(
                `${total} named customers. ${counts.lapsed} used to come regularly but have stopped.`,
                `${total} नाम वाले ग्राहक। ${counts.lapsed} पहले नियमित थे, अब नहीं आ रहे।`,
                `${total} naam wale customers. ${counts.lapsed} pehle regular the, ab nahi aa rahe.`,
              )
            : undefined
        }
      />
      <Tabs
        items={tabs}
        param="segment"
        defaultId="all"
        label={l("Customer type", "ग्राहक का प्रकार", "Customer ke type")}
      >
        {(active) => (
          <CustomerTable
            active={active}
            seg={seg}
            accounts={accounts}
            khataLoaded={Boolean(khata.data)}
            khataFailed={Boolean(khata.error) && !khata.data}
            retryKhata={khata.refetch}
          />
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

function CustomerTable({
  active,
  seg,
  accounts,
  khataLoaded,
  khataFailed,
  retryKhata,
}: TableProps) {
  const l = useL();
  const SEGMENT = segmentMeta(l);
  const SORT_OPTIONS = [
    {
      value: "lifetime",
      label: l(
        "Total spend, highest first",
        "कुल ख़र्चा, ज़्यादा पहले",
        "Kul kharcha, zyada pehle",
      ),
    },
    {
      value: "recent",
      label: l(
        "Most recent visit first",
        "हाल में आए पहले",
        "Haal mein aaye pehle",
      ),
    },
    {
      value: "visits",
      label: l("Most visits first", "ज़्यादा विज़िट पहले", "Zyada visit pehle"),
    },
    {
      value: "baaki",
      label: l("Highest due first", "ज़्यादा बाक़ी पहले", "Zyada baaki pehle"),
    },
  ];
  const { patch } = useQueryParams();
  const [sort, setSort] = useQueryState<SortKey>("sort", {
    defaultValue: "lifetime",
    allowed: SORTS,
  });
  const [text, setText] = useSearchText("q");
  const needle = text.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!seg.data) return undefined;
    const baaki = (c: CustomerSegment) =>
      accounts.get(c.customerId)?.outstandingPaise ?? 0;
    const order: Record<
      SortKey,
      (a: CustomerSegment, b: CustomerSegment) => number
    > = {
      lifetime: (a, b) => b.lifetimePaise - a.lifetimePaise,
      recent: (a, b) =>
        (a.lastVisitDaysAgo ?? Infinity) - (b.lastVisitDaysAgo ?? Infinity),
      visits: (a, b) =>
        b.visits30 - a.visits30 || b.lifetimePaise - a.lifetimePaise,
      baaki: (a, b) => baaki(b) - baaki(a) || b.lifetimePaise - a.lifetimePaise,
    };
    return seg.data.customers
      .filter(
        (c) =>
          (active === "all" || c.segment === active) &&
          (!needle || c.name.toLowerCase().includes(needle)),
      )
      .sort(order[sort]);
  }, [seg.data, accounts, active, needle, sort]);

  const columns: readonly Column<CustomerSegment>[] = [
    {
      key: "name",
      header: l("Customer", "ग्राहक", "Customer"),
      primary: true,
      cell: (c) => c.name,
    },
    {
      key: "segment",
      header: "Type",
      cell: (c) => (
        <Badge tone={SEGMENT[c.segment].tone}>{SEGMENT[c.segment].label}</Badge>
      ),
    },
    {
      key: "visits",
      header: l("Visits (30 days)", "विज़िट (30 दिन)", "Visit (30 din)"),
      num: true,
      cell: (c) => c.visits30,
    },
    {
      key: "last",
      header: l("Last visit", "आख़िरी विज़िट", "Aakhri visit"),
      cell: (c) =>
        c.lastVisitDaysAgo === null ? "" : daysAgoL(c.lastVisitDaysAgo, l),
    },
    {
      key: "spend30",
      header: l("Spend (30 days)", "ख़र्चा (30 दिन)", "Kharcha (30 din)"),
      num: true,
      cell: (c) => rupees(c.spend30Paise),
    },
    {
      key: "lifetime",
      header: l("Total spend", "कुल ख़र्चा", "Kul kharcha"),
      num: true,
      cell: (c) => rupees(c.lifetimePaise),
    },
    {
      key: "baaki",
      header: l("Due", "बाक़ी", "Baaki"),
      num: true,
      cell: (c) => {
        const a = accounts.get(c.customerId);
        if (a) {
          return (
            <Link
              href={`/dashboard/khata?customer=${encodeURIComponent(c.customerId)}`}
              aria-label={l(
                `Open ${c.name}'s khata, due ${rupees(a.outstandingPaise)}`,
                `${c.name} का खाता खोलें, बाक़ी ${rupees(a.outstandingPaise)}`,
                `${c.name} ka khata kholo, baaki ${rupees(a.outstandingPaise)}`,
              )}
            >
              {rupees(a.outstandingPaise)}
            </Link>
          );
        }
        return (
          <span className="kh-quiet">
            {khataLoaded ? l("None", "नहीं", "Nahi") : "-"}
          </span>
        );
      },
    },
    {
      key: "blocked",
      header: l("Credit", "उधार", "Udhaar"),
      cell: (c) => {
        const a = accounts.get(c.customerId);
        if (!a) return <span className="kh-quiet">-</span>;
        return a.creditBlocked ? (
          <Badge tone="danger">{l("Blocked", "बंद", "Band")}</Badge>
        ) : (
          <span className="kh-quiet">{l("Open", "चालू", "Chalu")}</span>
        );
      },
    },
  ];

  function clearFilters() {
    setText("");
    patch({ q: null, segment: null });
  }

  return (
    <section
      className="cu-panel"
      aria-label={l("Customer list", "ग्राहक सूची", "Customer list")}
    >
      {active !== "all" ? (
        <p className="cu-meaning">{SEGMENT[active].meaning}</p>
      ) : null}
      <div className="kh-filters" role="search">
        <Field label={l("Search by name", "नाम खोजें", "Naam dhundho")}>
          <Input
            type="search"
            name="q"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={l("For example Ramesh", "जैसे रमेश", "Jaise Ramesh")}
          />
        </Field>
        <Field label={l("Sort by", "क्रम", "Kaise sajayein")}>
          <Select
            name="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            options={SORT_OPTIONS}
          />
        </Field>
      </div>

      {seg.error && !seg.data ? (
        <ErrorState
          title={l(
            "Could not load the customer list",
            "ग्राहक सूची नहीं आई",
            "Customer list nahi aayi",
          )}
          error={seg.error}
          onRetry={seg.refetch}
          retrying={seg.loading}
        />
      ) : !rows ? (
        <Skeleton
          shape="rows"
          count={8}
          cols={5}
          label={l(
            "Loading customers",
            "ग्राहक लोड हो रहे हैं",
            "Customers load ho rahe hain",
          )}
        />
      ) : (
        <>
          <DataTable
            caption={l(
              "Customers, their visits and spend",
              "ग्राहक, उनकी विज़िट और ख़र्चा",
              "Customers, unki visit aur kharcha",
            )}
            columns={columns}
            rows={rows}
            rowKey={(c) => c.customerId}
            dense
            empty={
              <EmptyState
                title={l("Nothing found", "कुछ नहीं मिला", "Kuch nahi mila")}
                description={
                  needle
                    ? l(
                        "No customer with this name is in this type.",
                        "इस नाम का कोई ग्राहक इस प्रकार में नहीं है।",
                        "Is naam ka koi customer is type mein nahi hai.",
                      )
                    : l(
                        "There are no customers in this type yet.",
                        "इस प्रकार में अभी कोई ग्राहक नहीं है।",
                        "Is type mein abhi koi customer nahi hai.",
                      )
                }
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {l("Clear filter", "फ़िल्टर हटाएँ", "Filter hatao")}
                  </Button>
                }
              />
            }
          />
          {khataFailed ? (
            <p className="cu-note" role="alert">
              {l(
                "The due data did not load.",
                "बाक़ी का डेटा नहीं आया।",
                "Baaki ka data nahi aaya.",
              )}{" "}
              <button type="button" className="cu-link" onClick={retryKhata}>
                {l("Try again", "फिर कोशिश करें", "Dobara try karo")}
              </button>
            </p>
          ) : (
            <p className="cu-note">
              {l(
                "Credit open or blocked is shown only for customers who owe something.",
                "उधार चालू या बंद सिर्फ़ उन्हीं का दिखता है जिनका बाक़ी है।",
                "Udhaar chalu ya band sirf unka dikhta hai jinka baaki hai.",
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
