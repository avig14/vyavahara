"use client";

import { useLang } from "@/lib/ui/lang";
import { periodText } from "@/lib/ui/api-text";
import { useState } from "react";
import { useL } from "@/lib/ui/lang";
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
import { PERIOD_OPTIONS, periodLabelFor, usePeriod } from "@/lib/ui/period";
import type { PeriodName } from "@/lib/time";
import { WhatsAppCard } from "./whatsapp-card";
import {
  KhataPayablesSection,
  LostSection,
  ProfitSection,
  SalesSection,
  TopSection,
} from "./report-sections";

function Preview({ data }: { data: OverviewPayload }) {
  const l = useL();
  const { lang } = useLang();
  const r = data.report;
  const quiet =
    r.sales.bills === 0 &&
    r.lostSales.requests === 0 &&
    r.khata.red.length === 0 &&
    r.payablesDue.length === 0;
  return (
    <article
      className="rp-doc"
      aria-label={l("Report preview", "रिपोर्ट का प्रीव्यू", "Report preview")}
    >
      <header className="rp-masthead">
        <h2>{r.merchantName}</h2>
        <p>
          {periodText(r.period.label, lang)}. {l("Made", "बनाया", "Banaya")}{" "}
          <span className="num">{istStamp(r.generatedAt)}</span>.
        </p>
      </header>
      {quiet ? (
        <EmptyState
          title={l(
            "Nothing to report for this period",
            "इस अवधि में रिपोर्ट के लिए कुछ नहीं",
            "Is period mein report ke liye kuch nahi",
          )}
          description={l(
            "No sales, lost sale, red khata or due payment was found. Choose another period.",
            "कोई बिक्री, छूटी बिक्री, लाल खाता या देय पेमेंट नहीं मिला। दूसरी अवधि चुनें।",
            "Koi bikri, lost sale, red khata ya due payment nahi mila. Doosra period chuno.",
          )}
        />
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
  const l = useL();
  const { name, from, to, apiQuery, setPeriod, label } = usePeriod();
  const state = useApi<OverviewPayload>(`/api/dashboard/overview?${apiQuery}`);
  const toast = useToast();
  const { lang } = useLang();
  const OPTIONS = PERIOD_OPTIONS.map((p) => ({
    value: p.name,
    label: periodLabelFor(p.name, lang),
  }));
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const q = new URLSearchParams(apiQuery);
      const body =
        name === "custom" && from && to
          ? { period: "custom", from: q.get("from"), to: q.get("to") }
          : { period: name };
      const { url } = await postJson<{ url: string }>("/api/reports/pdf", body);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.rel = "noopener";
      document.body.append(a);
      a.click();
      a.remove();
      toast.push({
        title: l("PDF is ready", "PDF तैयार है", "PDF taiyar hai"),
        detail: l(
          "The link works for 7 days.",
          "लिंक 7 दिन चलेगा।",
          "Link 7 din chalega.",
        ),
        tone: "success",
      });
    } catch (e) {
      toast.push({
        title: l(
          "Could not make the PDF",
          "PDF नहीं बन पाया",
          "PDF nahi ban paya",
        ),
        detail: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        hindi="रिपोर्ट"
        description={l(
          `${label}. What you see here is what goes into the PDF.`,
          `${label}। जो यहाँ दिख रहा है वही PDF में जाएगा।`,
          `${label}. Jo yahan dikh raha hai wahi PDF mein jayega.`,
        )}
        actions={
          <>
            <Field label={l("Period", "अवधि", "Period")}>
              <Select
                value={name}
                onChange={(e) => setPeriod(e.target.value as PeriodName)}
                options={OPTIONS}
              />
            </Field>
            <Button
              variant="primary"
              loading={busy}
              disabled={!state.data || !!state.error}
              onClick={download}
            >
              {l("Download PDF", "PDF डाउनलोड करें", "PDF download karo")}
            </Button>
          </>
        }
      />
      <WhatsAppCard />
      <Region
        state={state}
        errorTitle={l(
          "Could not open the report",
          "रिपोर्ट नहीं खुल पाई",
          "Report nahi khul payi",
        )}
        skeleton={
          <Skeleton
            shape="rows"
            count={9}
            cols={3}
            label={l(
              "Loading the report",
              "रिपोर्ट लोड हो रही है",
              "Report load ho rahi hai",
            )}
          />
        }
      >
        {(d) => <Preview data={d} />}
      </Region>
    </>
  );
}
