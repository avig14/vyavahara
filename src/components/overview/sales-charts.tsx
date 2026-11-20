"use client";

import { BarSeries, Heatmap, compactRupees } from "@/components/charts";
import { T, useL } from "@/lib/ui/lang";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { rupees } from "@/lib/format";
import type { Heatmap as HeatmapData, ReportData } from "@/lib/reports/build";
import type { ApiState } from "@/lib/ui/api";
import { DAYS_FULL, hourWord, longDay, shortDay } from "@/lib/ui/dates";
import { Region } from "./region";
import type { OverviewPayload } from "./types";

function Daily({ report }: { report: ReportData }) {
  const l = useL();
  const { daily } = report;
  const best = daily.reduce<(typeof daily)[number] | null>(
    (b, d) => (b === null || d.totalPaise > b.totalPaise ? d : b),
    null,
  );
  if (!best || best.totalPaise <= 0)
    return (
      <EmptyState
        title={l(
          "No sales in this period",
          "इस अवधि में कोई बिक्री नहीं",
          "Is period mein koi bikri nahi",
        )}
        description={l(
          "Once bills are made, each day's sales will show here as a bar.",
          "बिल बनने पर हर दिन की बिक्री यहाँ बार बनकर दिखेगी।",
          "Bill banne par har din ki sales yahan bar ban kar dikhegi.",
        )}
      />
    );
  const first = daily[0].day;
  const last = daily[daily.length - 1].day;
  return (
    <>
      <BarSeries
        hint={l(
          "Each bar is one day's sales. The cyan bar is the best day. Hover or tap a bar to see the exact amount and how it compares with the other days.",
          "हर बार एक दिन की बिक्री है। नीला बार सबसे अच्छा दिन है। सही रक़म और बाक़ी दिनों से तुलना देखने के लिए बार पर माउस ले जाएँ या दबाएँ।",
          "Har bar ek din ki bikri hai. Cyan bar sabse achha din hai. Sahi raqam aur baaki dinon se tulna dekhne ke liye bar par mouse le jao ya dabao.",
        )}
        data={daily.map((d) => ({
          label: shortDay(d.day),
          value: d.totalPaise,
          highlight: d.day === best.day,
        }))}
        format={rupees}
        axisFormat={compactRupees}
        summary={l(
          `Daily sales, ${shortDay(first)} to ${shortDay(last)}. Best day ${longDay(best.day)}, ${rupees(best.totalPaise)}.`,
          `रोज़ की बिक्री, ${shortDay(first)} से ${shortDay(last)}। सबसे अच्छा दिन ${longDay(best.day)}, ${rupees(best.totalPaise)}।`,
          `Roz ki sales, ${shortDay(first)} se ${shortDay(last)}. Sabse achha din ${longDay(best.day)}, ${rupees(best.totalPaise)}.`,
        )}
      />
      <p className="ov-chart-fact">
        {l("Best day", "सबसे अच्छा दिन", "Sabse achha din")} {longDay(best.day)},{" "}
        <span className="num">{rupees(best.totalPaise)}</span>.
      </p>
    </>
  );
}

function Hours({ heat }: { heat: HeatmapData }) {
  const l = useL();
  const any = heat.cells.some((row) => row.some((v) => v > 0));
  if (!any)
    return (
      <EmptyState
        title={l(
          "No data yet",
          "अभी तक का कोई हिसाब नहीं",
          "Abhi tak ka koi hisaab nahi",
        )}
        description={l(
          "After a few days of sales, this will show which day and hour is busiest.",
          "कुछ दिन की बिक्री के बाद यहाँ दिखेगा कि किस दिन और घंटे में भीड़ रहती है।",
          "Kuch din ki bikri ke baad yahan dikhega ki kaunse din aur ghante mein bheed rehti hai.",
        )}
      />
    );
  const peak =
    heat.peakWeekday !== null && heat.peakHour !== null
      ? l(
          `${DAYS_FULL[heat.peakWeekday]}, ${hourWord(heat.peakHour)}`,
          `${DAYS_FULL[heat.peakWeekday]} का ${hourWord(heat.peakHour)}`,
          `${DAYS_FULL[heat.peakWeekday]} ka ${hourWord(heat.peakHour)}`,
        )
      : null;
  return (
    <>
      <Heatmap
        hint={l(
          "Each box is one hour of one weekday. Darker means more sales. Hover or tap a box to see the amount for that hour.",
          "हर डिब्बा एक वार का एक घंटा है। गहरा रंग यानी ज़्यादा बिक्री। उस घंटे की रक़म देखने के लिए डिब्बे पर माउस ले जाएँ या दबाएँ।",
          "Har dabba ek vaar ka ek ghanta hai. Gehra rang matlab zyada bikri. Us ghante ki raqam dekhne ke liye dabbe par mouse le jao ya dabao.",
        )}
        cells={heat.cells}
        format={rupees}
        summary={l(
          `Sales by day and hour, last ${heat.days} days.${peak ? ` Most sales ${peak}.` : ""}`,
          `दिन और घंटे के हिसाब से बिक्री, पिछले ${heat.days} दिन।${peak ? ` सबसे ज़्यादा बिक्री ${peak}।` : ""}`,
          `Din aur ghante ke hisaab se sales, pichhle ${heat.days} din.${peak ? ` Sabse zyada bikri ${peak}.` : ""}`,
        )}
      />
      <p className="ov-chart-fact">
        {peak
          ? `${l("Most sales", "सबसे ज़्यादा बिक्री", "Sabse zyada bikri")} ${peak}. `
          : ""}
        {l("Morning (5 to 12)", "सुबह (5 से 12)", "Subah (5 se 12)")}{" "}
        <span className="num">{rupees(heat.morningPaise)}</span>,{" "}
        {l("evening (4 to 10)", "शाम (4 से 10)", "shaam (4 se 10)")}{" "}
        <span className="num">{rupees(heat.eveningPaise)}</span>.
      </p>
    </>
  );
}

/** Day-by-day bars for the period, and the weekday by hour grid for the last stretch of days. */
export function SalesCharts({ state }: { state: ApiState<OverviewPayload> }) {
  const l = useL();
  return (
    <>
      <section aria-labelledby="daily-h" className="ov-sec">
        <div className="ov-head">
          <h2 id="daily-h">
            <T k="ov.daily" />
          </h2>
        </div>
        <Region
          state={state}
          errorTitle={l(
            "Could not load daily sales",
            "रोज़ की बिक्री नहीं खुली",
            "Roz ki sales nahi khuli",
          )}
          skeleton={
            <Skeleton
              shape="block"
              height="14rem"
              label={l(
                "Loading daily sales",
                "रोज़ की बिक्री लोड हो रही है",
                "Roz ki sales load ho rahi hain",
              )}
            />
          }
        >
          {(d) => <Daily report={d.report} />}
        </Region>
      </section>
      <section aria-labelledby="heat-h" className="ov-sec">
        <div className="ov-head">
          <h2 id="heat-h">
            <T k="ov.busy" />
          </h2>
          {state.data ? (
            <p className="ov-headmeta">
              {l(
                `Last ${state.data.heatmap.days} days`,
                `पिछले ${state.data.heatmap.days} दिन`,
                `Pichhle ${state.data.heatmap.days} din`,
              )}
            </p>
          ) : null}
        </div>
        <Region
          state={state}
          errorTitle={l(
            "Could not load the day and hour view",
            "दिन और घंटे का हिसाब नहीं खुला",
            "Din aur ghante ka hisaab nahi khula",
          )}
          skeleton={
            <Skeleton
              shape="block"
              height="14rem"
              label={l(
                "Loading the day and hour view",
                "दिन और घंटे का हिसाब लोड हो रहा है",
                "Din aur ghante ka hisaab load ho raha hai",
              )}
            />
          }
        >
          {(d) => <Hours heat={d.heatmap} />}
        </Region>
      </section>
    </>
  );
}
