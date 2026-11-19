"use client";

import { BarSeries, Heatmap, compactRupees } from "@/components/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { rupees } from "@/lib/format";
import type { Heatmap as HeatmapData, ReportData } from "@/lib/reports/build";
import type { ApiState } from "@/lib/ui/api";
import { DAYS_FULL, hourWord, longDay, shortDay } from "@/lib/ui/dates";
import { Region } from "./region";
import type { OverviewPayload } from "./types";

function Daily({ report }: { report: ReportData }) {
  const { daily } = report;
  const best = daily.reduce<(typeof daily)[number] | null>((b, d) => (b === null || d.totalPaise > b.totalPaise ? d : b), null);
  if (!best || best.totalPaise <= 0) return <EmptyState title="Is period mein koi bikri nahi" description="Bill banne par har din ki sales yahan bar ban kar dikhegi." />;
  const first = daily[0].day;
  const last = daily[daily.length - 1].day;
  return (
    <>
      <BarSeries
        data={daily.map((d) => ({ label: shortDay(d.day), value: d.totalPaise, highlight: d.day === best.day }))}
        format={rupees}
        axisFormat={compactRupees}
        summary={`Roz ki sales, ${shortDay(first)} se ${shortDay(last)}. Sabse achha din ${longDay(best.day)}, ${rupees(best.totalPaise)}.`}
      />
      <p className="ov-chart-fact">
        Sabse achha din {longDay(best.day)}, <span className="num">{rupees(best.totalPaise)}</span>.
      </p>
    </>
  );
}

function Hours({ heat }: { heat: HeatmapData }) {
  const any = heat.cells.some((row) => row.some((v) => v > 0));
  if (!any) return <EmptyState title="Abhi tak ka koi hisaab nahi" description="Kuch din ki bikri ke baad yahan dikhega ki kaunse din aur ghante mein bheed rehti hai." />;
  const peak = heat.peakWeekday !== null && heat.peakHour !== null ? `${DAYS_FULL[heat.peakWeekday]} ka ${hourWord(heat.peakHour)}` : null;
  return (
    <>
      <Heatmap
        cells={heat.cells}
        format={rupees}
        summary={`Din aur ghante ke hisaab se sales, pichhle ${heat.days} din.${peak ? ` Sabse zyada bikri ${peak}.` : ""}`}
      />
      <p className="ov-chart-fact">
        {peak ? `Sabse zyada bikri ${peak}. ` : ""}
        Subah (5 se 12) <span className="num">{rupees(heat.morningPaise)}</span>, shaam (4 se 10) <span className="num">{rupees(heat.eveningPaise)}</span>.
      </p>
    </>
  );
}

/** Day-by-day bars for the period, and the weekday by hour grid for the last stretch of days. */
export function SalesCharts({ state }: { state: ApiState<OverviewPayload> }) {
  return (
    <>
      <section aria-labelledby="daily-h" className="ov-sec">
        <div className="ov-head">
          <h2 id="daily-h">Roz ki sales</h2>
        </div>
        <Region state={state} errorTitle="Roz ki sales nahi khuli" skeleton={<Skeleton shape="block" height="14rem" label="Roz ki sales load ho rahi hain" />}>
          {(d) => <Daily report={d.report} />}
        </Region>
      </section>
      <section aria-labelledby="heat-h" className="ov-sec">
        <div className="ov-head">
          <h2 id="heat-h">Kab bheed rehti hai</h2>
          {state.data ? <p className="ov-headmeta">Pichhle {state.data.heatmap.days} din</p> : null}
        </div>
        <Region state={state} errorTitle="Din aur ghante ka hisaab nahi khula" skeleton={<Skeleton shape="block" height="14rem" label="Din aur ghante ka hisaab load ho raha hai" />}>
          {(d) => <Hours heat={d.heatmap} />}
        </Region>
      </section>
    </>
  );
}
