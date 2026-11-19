"use client";

import { EmptyState, ErrorState, PageHeader, Skeleton, Tabs, type TabItem } from "@/components/ui";
import { useApi } from "@/lib/ui/api";
import { CashflowTab } from "./cashflow-tab";
import { FestivalTab } from "./festival-tab";
import { GstTab } from "./gst-tab";
import { LoanTab } from "./loan-tab";
import type { GrowthResponse } from "./types";

type TabId = "festival" | "cashflow" | "loan" | "gst";

const TABS: readonly TabItem<TabId>[] = [
  { id: "festival", label: "Festival", hindi: "त्योहार" },
  { id: "cashflow", label: "Cashflow", hindi: "नकदी" },
  { id: "loan", label: "Loan", hindi: "लोन" },
  { id: "gst", label: "GST", hindi: "जीएसटी" },
];

const LOADING_LABEL: Record<TabId, string> = {
  festival: "Loading festival plan",
  cashflow: "Loading cashflow forecast",
  loan: "Loading loan check",
  gst: "Loading GST estimate",
};

function Loading({ tab }: { tab: TabId }) {
  return (
    <div className="gr-sec">
      <Skeleton shape="stat" count={tab === "gst" ? 3 : 4} label={LOADING_LABEL[tab]} />
      <Skeleton shape="rows" count={5} cols={tab === "cashflow" ? 6 : 4} />
    </div>
  );
}

function Panel({ tab, data }: { tab: TabId; data: GrowthResponse }) {
  if (tab === "festival") return <FestivalTab festivals={data.festivals} plans={data.festivalPlans} />;
  if (tab === "cashflow") return <CashflowTab cashflow={data.cashflow} />;
  if (tab === "loan") return <LoanTab loan={data.loan} />;
  return <GstTab gst={data.gst} />;
}

export function GrowthView() {
  const { data, error, loading, refetch } = useApi<GrowthResponse>("/api/dashboard/growth");

  return (
    <>
      <PageHeader
        title="Growth"
        hindi="तरक्की"
        description="Festival stock-up, the next 14 days of cash, loan eligibility and GST. Every figure comes from your own sales, khata and vendor bills."
      />
      <Tabs items={TABS} defaultId="festival" label="Growth sections">
        {(tab) => {
          if (error) return <ErrorState title="Could not load growth numbers" error={error} onRetry={refetch} retrying={loading} />;
          if (!data) return loading ? <Loading tab={tab} /> : <EmptyState title="Nothing to show yet" description="Growth numbers appear once the shop has sales and bills on record." />;
          return <Panel tab={tab} data={data} />;
        }}
      </Tabs>
    </>
  );
}
