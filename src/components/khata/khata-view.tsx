"use client";

import { useMemo } from "react";
import { useL } from "@/lib/ui/lang";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Stat,
  type Column,
} from "@/components/ui";
import { StackedBar } from "@/components/charts";
import { useApi } from "@/lib/ui/api";
import { istDate } from "@/lib/ui/date";
import {
  useQueryParams,
  useQueryState,
  useQueryString,
} from "@/lib/ui/url-state";
import { useSearchText } from "@/lib/ui/use-search-text";
import { rupees } from "@/lib/format";
import { LedgerPanel } from "./ledger-panel";
import { riskMeta } from "./risk";
import type { AccountJson, KhataResponse } from "./types";

const BANDS = ["all", "red", "amber", "green"] as const;
type BandFilter = (typeof BANDS)[number];
const SORTS = ["risk", "baaki", "purana"] as const;
type SortKey = (typeof SORTS)[number];

function sorter(key: SortKey): (a: AccountJson, b: AccountJson) => number {
  if (key === "baaki") return (a, b) => b.outstandingPaise - a.outstandingPaise;
  if (key === "purana")
    return (a, b) => b.oldestUnpaidDays - a.oldestUnpaidDays;
  return (a, b) => b.score - a.score || b.outstandingPaise - a.outstandingPaise;
}

export function KhataView() {
  const l = useL();
  const { data, error, refetch } = useApi<KhataResponse>(
    "/api/dashboard/khata",
  );
  const { patch } = useQueryParams();
  const [customer, setCustomer] = useQueryString("customer");
  const [band, setBand] = useQueryState<BandFilter>("band", {
    defaultValue: "all",
    allowed: BANDS,
  });
  const [sort, setSort] = useQueryState<SortKey>("sort", {
    defaultValue: "risk",
    allowed: SORTS,
  });
  const [text, setText] = useSearchText("q");

  const khata = data?.khata;
  const needle = text.trim().toLowerCase();
  const filtered = Boolean(needle) || band !== "all";

  const rows = useMemo(() => {
    if (!khata) return undefined;
    return khata.accounts
      .filter(
        (a) =>
          (band === "all" || a.band === band) &&
          (!needle || a.name.toLowerCase().includes(needle)),
      )
      .sort(sorter(sort));
  }, [khata, band, needle, sort]);

  const shownTotal = rows?.reduce((s, a) => s + a.outstandingPaise, 0) ?? 0;

  const RISK0 = riskMeta(l);
  const columns: readonly Column<AccountJson>[] = [
    {
      key: "name",
      header: l("Customer", "ग्राहक", "Customer"),
      primary: true,
      cell: (a) => a.name,
      footer: filtered
        ? l("Shown", "जो दिख रहे हैं", "Jo dikh rahe hain")
        : l("Total due", "कुल बाक़ी", "Kul baaki"),
    },
    {
      key: "baaki",
      header: l("Due", "बाक़ी", "Baaki"),
      num: true,
      cell: (a) => rupees(a.outstandingPaise),
      footer: rupees(shownTotal),
    },
    {
      key: "oldest",
      header: l("Oldest", "सबसे पुराना", "Sabse purana"),
      num: true,
      cell: (a) => `${a.oldestUnpaidDays} ${l("days", "दिन", "din")}`,
    },
    {
      key: "risk",
      header: l("Risk", "जोखिम", "Risk"),
      cell: (a) => (
        <Badge tone={RISK0[a.band].tone}>{RISK0[a.band].label}</Badge>
      ),
    },
    {
      key: "last",
      header: l("Last payment", "आख़िरी पेमेंट", "Aakhri payment"),
      cell: (a) =>
        a.lastPaymentAt ? (
          istDate(a.lastPaymentAt)
        ) : (
          <span className="kh-quiet">
            {l("No payment", "कोई पेमेंट नहीं", "Koi payment nahi")}
          </span>
        ),
    },
    {
      key: "blocked",
      header: l("Credit", "उधार", "Udhaar"),
      cell: (a) =>
        a.creditBlocked ? (
          <Badge tone="danger">{l("Blocked", "बंद", "Band")}</Badge>
        ) : (
          <span className="kh-quiet">{l("Open", "चालू", "Chalu")}</span>
        ),
    },
  ];

  const RISK = riskMeta(l);
  const BAND_OPTIONS = [
    { value: "all", label: l("All", "सब", "Sab") },
    { value: "red", label: RISK.red.label },
    { value: "amber", label: RISK.amber.label },
    { value: "green", label: RISK.green.label },
  ];
  const SORT_OPTIONS = [
    {
      value: "risk",
      label: l("Risk, highest first", "जोखिम, ज़्यादा पहले", "Risk, zyada pehle"),
    },
    {
      value: "baaki",
      label: l("Due, highest first", "बाक़ी, ज़्यादा पहले", "Baaki, zyada pehle"),
    },
    {
      value: "purana",
      label: l("Oldest first", "सबसे पुराना पहले", "Sabse purana pehle"),
    },
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
        description={
          khata
            ? l(
                `${khata.accounts.length} customers have udhaar due. Tap a name to open the full account.`,
                `${khata.accounts.length} ग्राहकों का उधार बाक़ी है। नाम पर दबाएँ, पूरा हिसाब खुलेगा।`,
                `${khata.accounts.length} customers ka udhaar baaki hai. Naam par dabayein, poora hisaab khulega.`,
              )
            : undefined
        }
      />

      {error && !khata ? (
        <DataTable
          caption="Khata"
          columns={columns}
          rows={undefined}
          rowKey={(a) => a.customerId}
          error={error}
          onRetry={refetch}
        />
      ) : !khata ? (
        <Skeleton
          shape="rows"
          count={7}
          cols={5}
          label={l(
            "Loading khata",
            "खाता लोड हो रहा है",
            "Khata load ho raha hai",
          )}
        />
      ) : khata.accounts.length === 0 ? (
        <EmptyState
          title={l(
            "No one owes anything right now",
            "अभी किसी का उधार बाक़ी नहीं",
            "Abhi kisi ka udhaar baaki nahi",
          )}
          description={l(
            "When a customer takes credit or a khata entry is made, the due amount, risk and oldest date will show here.",
            "जब कोई ग्राहक उधार लेगा या खाता लिखा जाएगा, यहाँ बाक़ी, जोखिम और पुरानी तारीख़ दिखेगी।",
            "Jab koi customer udhaar lega ya khata likha jayega, yahan baaki, risk aur purani date dikhegi.",
          )}
        />
      ) : (
        <>
          <div className="kh-top">
            <div className="kh-figs">
              <Stat
                label={l("Total due", "कुल बाक़ी", "Kul baaki")}
                figure={rupees(khata.totalOutstandingPaise)}
                size="lg"
              />
              <Stat
                label={l(
                  "Expected to come back",
                  "वापस आने की उम्मीद",
                  "Wapas aane ki ummeed",
                )}
                figure={rupees(khata.expectedRecoveryPaise)}
                note={l(
                  "An estimate based on each customer's risk",
                  "हर ग्राहक के जोखिम के हिसाब से अनुमान",
                  "Har customer ke risk ke hisaab se andaaza",
                )}
              />
            </div>
            <section aria-labelledby="kh-ageing" className="kh-ageing">
              <h2 id="kh-ageing">
                {l(
                  "How old the dues are",
                  "बाक़ी कितना पुराना है",
                  "Baaki kitna purana hai",
                )}
              </h2>
              <StackedBar
                hint={l(
                  "Each part shows how much money has been pending for that long. The wider the part, the more money. The older parts (darker) need attention first. Hover or tap a part for details.",
                  "हर हिस्सा दिखाता है कि कितना पैसा उतने समय से बाक़ी है। हिस्सा जितना चौड़ा, पैसा उतना ज़्यादा। पुराने (गहरे) हिस्सों पर पहले ध्यान दें। ब्योरे के लिए हिस्से पर माउस ले जाएँ या दबाएँ।",
                  "Har hissa dikhata hai ki kitna paisa utne samay se baaki hai. Hissa jitna chauda, paisa utna zyada. Purane (gehre) hisson par pehle dhyaan do. Byore ke liye hisse par mouse le jao ya dabao.",
                )}
                format={rupees}
                summary={l(
                  `Total due ${rupees(khata.totalOutstandingPaise)}: 0 to 15 days ${rupees(khata.ageing.d0_15)}, 16 to 30 days ${rupees(khata.ageing.d16_30)}, 31 to 60 days ${rupees(khata.ageing.d31_60)}, over 60 days ${rupees(khata.ageing.d60p)}`,
                  `कुल बाक़ी ${rupees(khata.totalOutstandingPaise)}: 0 से 15 दिन ${rupees(khata.ageing.d0_15)}, 16 से 30 दिन ${rupees(khata.ageing.d16_30)}, 31 से 60 दिन ${rupees(khata.ageing.d31_60)}, 60 दिन से ऊपर ${rupees(khata.ageing.d60p)}`,
                  `Kul baaki ${rupees(khata.totalOutstandingPaise)}: 0 se 15 din ${rupees(khata.ageing.d0_15)}, 16 se 30 din ${rupees(khata.ageing.d16_30)}, 31 se 60 din ${rupees(khata.ageing.d31_60)}, 60 din se upar ${rupees(khata.ageing.d60p)}`,
                )}
                segments={[
                  {
                    label: l("0 to 15 days", "0 से 15 दिन", "0 se 15 din"),
                    value: khata.ageing.d0_15,
                    tone: "s4",
                  },
                  {
                    label: l("16 to 30 days", "16 से 30 दिन", "16 se 30 din"),
                    value: khata.ageing.d16_30,
                    tone: "s3",
                  },
                  {
                    label: l("31 to 60 days", "31 से 60 दिन", "31 se 60 din"),
                    value: khata.ageing.d31_60,
                    tone: "warn",
                  },
                  {
                    label: l("Over 60 days", "60 दिन से ऊपर", "60 din se upar"),
                    value: khata.ageing.d60p,
                    tone: "danger",
                  },
                ]}
              />
            </section>
          </div>

          <section aria-labelledby="kh-list" className="kh-list">
            <h2 id="kh-list">
              {l(
                "Dues by customer",
                "ग्राहक के हिसाब से बाक़ी",
                "Customer wise baaki",
              )}
            </h2>
            <div className="kh-filters" role="search">
              <Field label={l("Search by name", "नाम खोजें", "Naam dhundho")}>
                <Input
                  type="search"
                  name="q"
                  autoComplete="off"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={l(
                    "For example Suresh",
                    "जैसे सुरेश",
                    "Jaise Suresh",
                  )}
                />
              </Field>
              <Field label={l("Risk", "जोखिम", "Risk")}>
                <Select
                  name="band"
                  value={band}
                  onChange={(e) => setBand(e.target.value as BandFilter)}
                  options={BAND_OPTIONS}
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
            <DataTable
              caption={l(
                "Customers with credit due",
                "जिन ग्राहकों का उधार बाक़ी है",
                "Customers jinka udhaar baaki hai",
              )}
              columns={columns}
              rows={rows}
              rowKey={(a) => a.customerId}
              selectedKey={customer || null}
              onSelect={setCustomer}
              empty={
                <EmptyState
                  title={l("Nothing found", "कुछ नहीं मिला", "Kuch nahi mila")}
                  description={l(
                    "No customer with this name or risk is on the list.",
                    "इस नाम या जोखिम का कोई ग्राहक सूची में नहीं है।",
                    "Is naam ya risk ka koi customer baaki list mein nahi hai.",
                  )}
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      {l("Clear filter", "फ़िल्टर हटाएँ", "Filter hatao")}
                    </Button>
                  }
                />
              }
            />
          </section>

          {customer ? (
            <LedgerPanel
              customerId={customer}
              onClose={() => setCustomer(null)}
              onChanged={refetch}
            />
          ) : null}
        </>
      )}
    </>
  );
}
