"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Region } from "@/components/overview/region";
import type { OverviewPayload } from "@/components/overview/types";
import { postJson, useApi } from "@/lib/ui/api";
import { istStamp } from "@/lib/ui/dates";
import { PERIOD_OPTIONS, usePeriod } from "@/lib/ui/period";
import type { PeriodName } from "@/lib/time";
import { KhataPayablesSection, LostSection, ProfitSection, SalesSection, TopSection } from "./report-sections";

const OPTIONS = PERIOD_OPTIONS.map((p) => ({ value: p.name, label: p.label }));

function Preview({ data }: { data: OverviewPayload }) {
  const r = data.report;
  const quiet = r.sales.bills === 0 && r.lostSales.requests === 0 && r.khata.red.length === 0 && r.payablesDue.length === 0;
  return (
    <article className="rp-doc" aria-label="Report preview">
      <header className="rp-masthead">
        <h2>{r.merchantName}</h2>
        <p>
          {r.period.label}. Banaya <span className="num">{istStamp(r.generatedAt)}</span>.
        </p>
      </header>
      {quiet ? (
        <EmptyState title="Is period mein report ke liye kuch nahi" description="Koi bikri, lost sale, red khata ya due payment nahi mila. Doosra period chuno." />
      ) : null}
      <SalesSection report={r} />
      <ProfitSection report={r} />
      <TopSection report={r} />
      <LostSection report={r} />
      <KhataPayablesSection report={r} />
    </article>
  );
}

/** Period in the URL, a preview of the same report the overview uses, and a PDF made from it. */
export function ReportsScreen() {
  const { name, from, to, apiQuery, setPeriod, label } = usePeriod();
  const state = useApi<OverviewPayload>(`/api/dashboard/overview?${apiQuery}`);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const q = new URLSearchParams(apiQuery);
      const body = name === "custom" && from && to ? { period: "custom", from: q.get("from"), to: q.get("to") } : { period: name };
      const { url } = await postJson<{ url: string }>("/api/reports/pdf", body);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.rel = "noopener";
      document.body.append(a);
      a.click();
      a.remove();
      toast.push({ title: "PDF taiyar hai", detail: "Link 7 din chalega.", tone: "success" });
    } catch (e) {
      toast.push({ title: "PDF nahi ban paya", detail: e instanceof Error ? e.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        hindi="रिपोर्ट"
        description={`${label}. Jo yahan dikh raha hai wahi PDF mein jayega.`}
        actions={
          <>
            <Field label="Period">
              <Select value={name} onChange={(e) => setPeriod(e.target.value as PeriodName)} options={OPTIONS} />
            </Field>
            <Button variant="primary" loading={busy} disabled={!state.data || !!state.error} onClick={download}>
              PDF download karo
            </Button>
          </>
        }
      />
      <Region state={state} errorTitle="Report nahi khul payi" skeleton={<Skeleton shape="rows" count={9} cols={3} label="Report load ho rahi hai" />}>
        {(d) => <Preview data={d} />}
      </Region>
    </>
  );
}
