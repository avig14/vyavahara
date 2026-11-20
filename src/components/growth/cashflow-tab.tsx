"use client";

import type { CashDay, CashFlow } from "@/lib/analytics/cashflow";
import { LineBand, compactRupees, type LinePoint } from "@/components/charts";
import {
  DataTable,
  EmptyState,
  Stat,
  Stats,
  type Column,
} from "@/components/ui";
import { rupees } from "@/lib/format";
import { engineText } from "@/lib/ui/api-text";
import { dayLabel, dayLabelWeekday } from "@/lib/ui/ist-labels";
import { useL, type L } from "@/lib/ui/lang";

const money = (p: number) => (
  <span className={p < 0 ? "gr-neg" : undefined}>{rupees(p)}</span>
);
const dash = (p: number) => (p === 0 ? "-" : rupees(p));

const cols = (l: L): readonly Column<CashDay>[] => [
  {
    key: "date",
    header: l("Day", "दिन", "Din"),
    primary: true,
    cell: (d) => dayLabelWeekday(d.date),
  },
  {
    key: "sales",
    header: l("Sales in", "बिक्री से आया", "Bikri se aaya"),
    num: true,
    cell: (d) => rupees(d.inflowSalesPaise),
  },
  {
    key: "coll",
    header: l("Khata in", "खाते से आया", "Khata se aaya"),
    num: true,
    cell: (d) => rupees(d.inflowCollectionsPaise),
  },
  {
    key: "pay",
    header: l("Vendor bills out", "सप्लायर बिल गए", "Vendor bills gaye"),
    num: true,
    cell: (d) => dash(d.outflowPayablesPaise),
  },
  {
    key: "exp",
    header: l("Expenses out", "ख़र्चा गया", "Kharcha gaya"),
    num: true,
    cell: (d) => dash(d.outflowExpensesPaise),
  },
  {
    key: "net",
    header: l("Net", "शुद्ध", "Net"),
    num: true,
    cell: (d) => money(d.netPaise),
  },
  {
    key: "run",
    header: l("Running balance", "चालू बैलेंस", "Running balance"),
    num: true,
    cell: (d) => money(d.cumulativePaise),
  },
];

export function CashflowTab({ cashflow }: { cashflow: CashFlow }) {
  const l = useL();
  const { series, warnings } = cashflow;
  if (series.length === 0) {
    return (
      <EmptyState
        title={l(
          "No forecast yet",
          "अभी कोई अनुमान नहीं",
          "Abhi koi anumaan nahi",
        )}
        description={l(
          "The 14-day cash forecast needs some sales history.",
          "14 दिन के कैश अनुमान के लिए कुछ बिक्री का रिकॉर्ड चाहिए।",
          "14 din ke cash anumaan ke liye kuch bikri ka record chahiye.",
        )}
      />
    );
  }
  const points: LinePoint[] = series.map((d) => ({
    label: dayLabel(d.date),
    forecast: d.cumulativePaise,
  }));
  const low = series.reduce((a, b) =>
    b.cumulativePaise < a.cumulativePaise ? b : a,
  );
  const first = series[0];
  const last = series[series.length - 1];
  const net = cashflow.totalInflowPaise - cashflow.totalOutflowPaise;
  const runLabel = l("Running balance", "चालू बैलेंस", "Running balance");

  return (
    <div>
      <section
        className="gr-sec"
        aria-label={l("Cash summary", "कैश का सार", "Cash ka saar")}
      >
        <div className="gr-head">
          <h2>
            {l(
              `Next ${series.length} days`,
              `अगले ${series.length} दिन`,
              `Agle ${series.length} din`,
            )}
          </h2>
          <p>
            {dayLabel(first.date)} {l("to", "से", "se")} {dayLabel(last.date)}.{" "}
            {l(
              "Forecast sales and khata collections come in, vendor bills and fixed expenses go out. The running balance starts from the opening balance in Settings.",
              "अनुमानित बिक्री और खाते की वसूली आती है, सप्लायर के बिल और तय ख़र्चे जाते हैं। चालू बैलेंस सेटिंग के शुरुआती बैलेंस से शुरू होता है।",
              "Anumaanit bikri aur khata ki wasooli aati hai, vendor ke bills aur tay kharche jaate hain. Running balance Settings ke opening balance se shuru hota hai.",
            )}
          </p>
        </div>
        <Stats>
          <Stat
            label={l("Expected in", "आने की उम्मीद", "Aane ki ummeed")}
            figure={rupees(cashflow.totalInflowPaise)}
            note={`${l("Khata collections", "खाते की वसूली", "Khata ki wasooli")} ${rupees(cashflow.collectionsPaise)}`}
          />
          <Stat
            label={l("Expected out", "जाने की उम्मीद", "Jaane ki ummeed")}
            figure={rupees(cashflow.totalOutflowPaise)}
          />
          <Stat
            label={l("Net", "शुद्ध", "Net")}
            figure={rupees(net)}
            tone={net < 0 ? "danger" : "success"}
          />
          <Stat
            label={l("Lowest balance", "सबसे कम बैलेंस", "Sabse kam balance")}
            figure={rupees(low.cumulativePaise)}
            note={dayLabel(low.date)}
            tone={low.cumulativePaise < 0 ? "danger" : "neutral"}
          />
        </Stats>
      </section>

      <section
        className="gr-sec"
        aria-label={l(
          "Running balance chart",
          "चालू बैलेंस का चार्ट",
          "Running balance ka chart",
        )}
      >
        <div className="gr-head">
          <h2>{runLabel}</h2>
        </div>
        <LineBand
          hint={l(
            "The line is the cash you would hold at the end of each day. Going up means more is coming in than going out. Below ₹0 means you would be short. Hover or tap a day for details.",
            "लाइन हर दिन के अंत में आपके पास रहने वाला कैश है। ऊपर जाना यानी आने वाला पैसा जाने वाले से ज़्यादा। ₹0 से नीचे यानी कमी रहेगी। ब्योरे के लिए किसी दिन पर माउस ले जाएँ या दबाएँ।",
            "Line har din ke ant mein aapke paas rehne wala cash hai. Upar jaana matlab aane wala paisa jaane wale se zyada. ₹0 se neeche matlab kami rahegi. Byore ke liye kisi din par mouse le jao ya dabao.",
          )}
          explain={(p) =>
            p.forecast !== null && p.forecast !== undefined && p.forecast < 0
              ? l(
                  "You would be short of cash on this day. Plan ahead.",
                  "इस दिन कैश की कमी रहेगी। पहले से तैयारी करें।",
                  "Is din cash ki kami rahegi. Pehle se taiyaari karo.",
                )
              : l(
                  "Cash expected in hand at the end of this day.",
                  "इस दिन के अंत में हाथ में रहने वाला अनुमानित कैश।",
                  "Is din ke ant mein haath mein rehne wala anumaanit cash.",
                )
          }
          points={points}
          forecastLabel={runLabel}
          format={rupees}
          axisFormat={compactRupees}
          summary={l(
            `Forecast running balance from ${dayLabel(first.date)} to ${dayLabel(last.date)}. Lowest ${rupees(low.cumulativePaise)} on ${dayLabel(low.date)}, ending ${rupees(last.cumulativePaise)}.`,
            `${dayLabel(first.date)} से ${dayLabel(last.date)} तक चालू बैलेंस का अनुमान। सबसे कम ${rupees(low.cumulativePaise)} (${dayLabel(low.date)}), अंत में ${rupees(last.cumulativePaise)}।`,
            `${dayLabel(first.date)} se ${dayLabel(last.date)} tak running balance ka anumaan. Sabse kam ${rupees(low.cumulativePaise)} (${dayLabel(low.date)}), ant mein ${rupees(last.cumulativePaise)}.`,
          )}
        />
      </section>

      {warnings.length > 0 ? (
        <section
          className="gr-sec"
          aria-label={l(
            "Shortfall warnings",
            "कमी की चेतावनी",
            "Kami ki chetavni",
          )}
        >
          <div className="gr-head">
            <h2>
              {l(
                "Shortfalls to plan for",
                "जिस कमी की तैयारी करनी है",
                "Jis kami ki taiyaari karni hai",
              )}
            </h2>
          </div>
          <ul className="gr-list">
            {warnings.map((w) => (
              <li key={w.purchaseId}>
                <strong>{dayLabel(w.date)}:</strong>{" "}
                {l(
                  `${rupees(w.payablePaise)} to ${w.vendorName} leaves you ${rupees(w.shortfallPaise)} short.`,
                  `${w.vendorName} को ${rupees(w.payablePaise)} देने पर ${rupees(w.shortfallPaise)} की कमी रहेगी।`,
                  `${w.vendorName} ko ${rupees(w.payablePaise)} dene par ${rupees(w.shortfallPaise)} ki kami rahegi.`,
                )}
                {w.suggestions.length > 0
                  ? ` ${engineText(w.suggestions[0].text, l)}.`
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="gr-sec"
        aria-label={l("Day by day", "दिन के हिसाब से", "Din ke hisaab se")}
      >
        <div className="gr-head">
          <h2>{l("Day by day", "दिन के हिसाब से", "Din ke hisaab se")}</h2>
        </div>
        <DataTable
          caption={l(
            "Expected cash in and out, day by day",
            "दिन के हिसाब से कैश की आमद और ख़र्च",
            "Din ke hisaab se cash ki aamad aur kharch",
          )}
          columns={cols(l)}
          rows={series}
          rowKey={(d) => d.date}
          dense
        />
      </section>
    </div>
  );
}
