"use client";

import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Tabs,
  type TabItem,
} from "@/components/ui";
import { useL } from "@/lib/ui/lang";
import { useApi } from "@/lib/ui/api";
import { CashflowTab } from "./cashflow-tab";
import { FestivalTab } from "./festival-tab";
import { GstTab } from "./gst-tab";
import { LoanTab } from "./loan-tab";
import type { GrowthResponse } from "./types";

type TabId = "festival" | "cashflow" | "loan" | "gst";

function Loading({ tab }: { tab: TabId }) {
  const l = useL();
  const LOADING_LABEL: Record<TabId, string> = {
    festival: l(
      "Loading festival plan",
      "त्योहार की योजना लोड हो रही है",
      "Tyohaar ki yojana load ho rahi hai",
    ),
    cashflow: l(
      "Loading cashflow forecast",
      "कैश का अनुमान लोड हो रहा है",
      "Cash ka anumaan load ho raha hai",
    ),
    loan: l(
      "Loading loan check",
      "लोन की जाँच लोड हो रही है",
      "Loan ki jaanch load ho rahi hai",
    ),
    gst: l(
      "Loading GST estimate",
      "GST का अनुमान लोड हो रहा है",
      "GST ka anumaan load ho raha hai",
    ),
  };
  return (
    <div className="gr-sec">
      <Skeleton
        shape="stat"
        count={tab === "gst" ? 3 : 4}
        label={LOADING_LABEL[tab]}
      />
      <Skeleton shape="rows" count={5} cols={tab === "cashflow" ? 6 : 4} />
    </div>
  );
}

function Panel({ tab, data }: { tab: TabId; data: GrowthResponse }) {
  if (tab === "festival")
    return (
      <FestivalTab festivals={data.festivals} plans={data.festivalPlans} />
    );
  if (tab === "cashflow") return <CashflowTab cashflow={data.cashflow} />;
  if (tab === "loan") return <LoanTab loan={data.loan} />;
  return <GstTab gst={data.gst} />;
}

export function GrowthView() {
  const l = useL();
  const { data, error, loading, refetch } = useApi<GrowthResponse>(
    "/api/dashboard/growth",
  );
  const TABS: readonly TabItem<TabId>[] = [
    { id: "festival", label: l("Festival", "त्योहार", "Tyohaar") },
    { id: "cashflow", label: l("Cashflow", "नकदी", "Cashflow") },
    { id: "loan", label: l("Loan", "लोन", "Loan") },
    { id: "gst", label: "GST" },
  ];

  return (
    <>
      <PageHeader
        title="Growth"
        hindi="तरक्की"
        description={l(
          "Festival stock-up, the next 14 days of cash, loan eligibility and GST. Every figure comes from your own sales, khata and vendor bills.",
          "त्योहार की स्टॉक तैयारी, अगले 14 दिन का कैश, लोन पात्रता और GST। हर आँकड़ा आपकी अपनी बिक्री, खाता और सप्लायर बिलों से आता है।",
          "Festival stock-up, agle 14 din ka cash, loan eligibility aur GST. Har figure aapki apni sales, khata aur vendor bills se aata hai.",
        )}
      />
      <Tabs
        items={TABS}
        defaultId="festival"
        label={l("Growth sections", "ग्रोथ के भाग", "Growth ke hisse")}
      >
        {(tab) => {
          if (error)
            return (
              <ErrorState
                title={l(
                  "Could not load growth numbers",
                  "ग्रोथ के आँकड़े नहीं खुल पाए",
                  "Growth ke aankde nahi khul paye",
                )}
                error={error}
                onRetry={refetch}
                retrying={loading}
              />
            );
          if (!data)
            return loading ? (
              <Loading tab={tab} />
            ) : (
              <EmptyState
                title={l(
                  "Nothing to show yet",
                  "अभी दिखाने को कुछ नहीं",
                  "Abhi dikhane ko kuch nahi",
                )}
                description={l(
                  "Growth numbers appear once the shop has sales and bills on record.",
                  "दुकान में बिक्री और बिल दर्ज होने पर ग्रोथ के आँकड़े दिखेंगे।",
                  "Dukaan mein bikri aur bills darj hone par growth ke aankde dikhenge.",
                )}
              />
            );
          return <Panel tab={tab} data={data} />;
        }}
      </Tabs>
    </>
  );
}
