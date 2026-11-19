"use client";

import type { GstSlab } from "@/lib/analytics/gst";
import { Badge, DataTable, EmptyState, Stat, Stats, type Column } from "@/components/ui";
import { num, rupees } from "@/lib/format";
import { dayLabel } from "@/lib/ui/ist-labels";
import type { GrowthResponse } from "./types";

const SLAB_COLS: readonly Column<GstSlab>[] = [
  { key: "rate", header: "GST rate", primary: true, cell: (s) => `${num(s.ratePct, 2)}%` },
  { key: "gross", header: "Sales (with tax)", num: true, cell: (s) => rupees(s.grossPaise) },
  { key: "taxable", header: "Taxable value", num: true, cell: (s) => rupees(s.taxablePaise) },
  { key: "out", header: "Tax collected", num: true, cell: (s) => rupees(s.outputTaxPaise) },
  { key: "in", header: "Tax paid on purchases", num: true, cell: (s) => rupees(s.inputTaxPaise) },
];

const SCHEME = { composition: "Composition scheme", regular: "Regular scheme", none: "No GST scheme set" } as const;

export function GstTab({ gst }: { gst: GrowthResponse["gst"] }) {
  const p = gst.period;
  if (gst.scheme === "none") {
    return <EmptyState title="No GST scheme set" description={gst.note || "Choose composition or regular GST in Settings to see an estimate."} />;
  }
  return (
    <div>
      <section className="gr-sec" aria-label="GST estimate">
        <div className="gr-head">
          <h2>
            {p.label} <Badge tone="info">{SCHEME[gst.scheme]}</Badge>
          </h2>
          <p>
            {dayLabel(p.from)} to {dayLabel(p.to)}. {gst.note}
          </p>
        </div>
        <Stats>
          <Stat label="Turnover so far" figure={rupees(gst.turnoverPaise)} />
          {gst.scheme === "composition" ? (
            <>
              <Stat label="Composition rate" figure={`${num(gst.compositionRatePct ?? 0, 2)}%`} />
              <Stat label="Estimated tax due" figure={rupees(gst.compositionTaxPaise ?? 0)} size="lg" />
            </>
          ) : (
            <>
              <Stat label="Tax collected" figure={rupees(gst.outputTaxPaise ?? 0)} />
              <Stat label="Tax paid on purchases" figure={rupees(gst.inputTaxPaise ?? 0)} />
              <Stat label="Estimated net payable" figure={rupees(gst.netPayablePaise ?? 0)} tone={(gst.netPayablePaise ?? 0) > 0 ? "warn" : "neutral"} size="lg" />
            </>
          )}
        </Stats>
      </section>

      {gst.scheme === "regular" ? (
        <section className="gr-sec" aria-label="By rate">
          <div className="gr-head">
            <h2>By GST rate</h2>
          </div>
          <DataTable
            caption="GST estimate by rate"
            columns={SLAB_COLS}
            rows={gst.slabs ?? []}
            rowKey={(s) => String(s.ratePct)}
            dense
            empty={<EmptyState title="No sales in this period" description="Rates show here once there are taxed sales." />}
          />
        </section>
      ) : null}

      <p className="gr-note">{gst.disclaimer}</p>
    </div>
  );
}
