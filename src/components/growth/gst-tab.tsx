"use client";

import type { GstSlab } from "@/lib/analytics/gst";
import {
  Badge,
  DataTable,
  EmptyState,
  Stat,
  Stats,
  type Column,
} from "@/components/ui";
import { num, rupees } from "@/lib/format";
import { engineText } from "@/lib/ui/api-text";
import { dayLabel } from "@/lib/ui/ist-labels";
import { useL, type L } from "@/lib/ui/lang";
import type { GrowthResponse } from "./types";

const slabCols = (l: L): readonly Column<GstSlab>[] => [
  {
    key: "rate",
    header: l("GST rate", "GST दर", "GST rate"),
    primary: true,
    cell: (s) => `${num(s.ratePct, 2)}%`,
  },
  {
    key: "gross",
    header: l("Sales (with tax)", "बिक्री (टैक्स समेत)", "Sales (tax ke saath)"),
    num: true,
    cell: (s) => rupees(s.grossPaise),
  },
  {
    key: "taxable",
    header: l("Taxable value", "कर योग्य मूल्य", "Taxable value"),
    num: true,
    cell: (s) => rupees(s.taxablePaise),
  },
  {
    key: "out",
    header: l("Tax collected", "वसूला टैक्स", "Tax collected"),
    num: true,
    cell: (s) => rupees(s.outputTaxPaise),
  },
  {
    key: "in",
    header: l(
      "Tax paid on purchases",
      "ख़रीद पर दिया टैक्स",
      "Purchases par diya tax",
    ),
    num: true,
    cell: (s) => rupees(s.inputTaxPaise),
  },
];

export function GstTab({ gst }: { gst: GrowthResponse["gst"] }) {
  const l = useL();
  const p = gst.period;
  const scheme = {
    composition: l("Composition scheme", "कंपोज़िशन स्कीम", "Composition scheme"),
    regular: l("Regular scheme", "रेगुलर स्कीम", "Regular scheme"),
    none: l(
      "No GST scheme set",
      "कोई GST स्कीम तय नहीं",
      "Koi GST scheme tay nahi",
    ),
  } as const;
  if (gst.scheme === "none") {
    return (
      <EmptyState
        title={l(
          "No GST scheme set",
          "कोई GST स्कीम तय नहीं",
          "Koi GST scheme tay nahi",
        )}
        description={
          gst.note
            ? engineText(gst.note, l)
            : l(
                "Choose composition or regular GST in Settings to see an estimate.",
                "अनुमान देखने के लिए सेटिंग में कंपोज़िशन या रेगुलर GST चुनें।",
                "Anumaan dekhne ke liye Settings mein composition ya regular GST chuno.",
              )
        }
      />
    );
  }
  return (
    <div>
      <section
        className="gr-sec"
        aria-label={l("GST estimate", "GST का अनुमान", "GST ka anumaan")}
      >
        <div className="gr-head">
          <h2>
            {p.label} <Badge tone="info">{scheme[gst.scheme]}</Badge>
          </h2>
          <p>
            {dayLabel(p.from)} {l("to", "से", "se")} {dayLabel(p.to)}.{" "}
            {engineText(gst.note, l)}
          </p>
        </div>
        <Stats>
          <Stat
            label={l(
              "Turnover so far",
              "अब तक का टर्नओवर",
              "Ab tak ka turnover",
            )}
            figure={rupees(gst.turnoverPaise)}
          />
          {gst.scheme === "composition" ? (
            <>
              <Stat
                label={l("Composition rate", "कंपोज़िशन दर", "Composition rate")}
                figure={`${num(gst.compositionRatePct ?? 0, 2)}%`}
              />
              <Stat
                label={l(
                  "Estimated tax due",
                  "अनुमानित देय टैक्स",
                  "Anumaanit tax due",
                )}
                figure={rupees(gst.compositionTaxPaise ?? 0)}
                size="lg"
              />
            </>
          ) : (
            <>
              <Stat
                label={l("Tax collected", "वसूला टैक्स", "Tax collected")}
                figure={rupees(gst.outputTaxPaise ?? 0)}
              />
              <Stat
                label={l(
                  "Tax paid on purchases",
                  "ख़रीद पर दिया टैक्स",
                  "Purchases par diya tax",
                )}
                figure={rupees(gst.inputTaxPaise ?? 0)}
              />
              <Stat
                label={l(
                  "Estimated net payable",
                  "अनुमानित कुल देय",
                  "Anumaanit net payable",
                )}
                figure={rupees(gst.netPayablePaise ?? 0)}
                tone={(gst.netPayablePaise ?? 0) > 0 ? "warn" : "neutral"}
                size="lg"
              />
            </>
          )}
        </Stats>
      </section>

      {gst.scheme === "regular" ? (
        <section
          className="gr-sec"
          aria-label={l("By rate", "दर के हिसाब से", "Rate ke hisaab se")}
        >
          <div className="gr-head">
            <h2>
              {l("By GST rate", "GST दर के हिसाब से", "GST rate ke hisaab se")}
            </h2>
          </div>
          <DataTable
            caption={l(
              "GST estimate by rate",
              "दर के हिसाब से GST का अनुमान",
              "Rate ke hisaab se GST ka anumaan",
            )}
            columns={slabCols(l)}
            rows={gst.slabs ?? []}
            rowKey={(s) => String(s.ratePct)}
            dense
            empty={
              <EmptyState
                title={l(
                  "No sales in this period",
                  "इस अवधि में कोई बिक्री नहीं",
                  "Is period mein koi bikri nahi",
                )}
                description={l(
                  "Rates show here once there are taxed sales.",
                  "टैक्स वाली बिक्री होने पर दरें यहाँ दिखेंगी।",
                  "Tax wali bikri hone par rates yahan dikhengi.",
                )}
              />
            }
          />
        </section>
      ) : null}

      <p className="gr-note">{engineText(gst.disclaimer, l)}</p>
    </div>
  );
}
