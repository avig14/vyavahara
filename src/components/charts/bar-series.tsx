"use client";

import { cx } from "@/lib/ui/cx";
import { compact, labelIndices, niceMax, tickValues } from "./scale";
import { useWidth } from "./use-width";

export interface BarDatum {
  label: string;
  value: number;
  /** the bar the chart argues from: cyan, and always labelled */
  highlight?: boolean;
}

export interface BarSeriesProps {
  data: readonly BarDatum[];
  summary: string;
  /** exact value text, for labels and tooltips (e.g. paise through `rupees`) */
  format?: (value: number) => string;
  /** short value text for the y axis (e.g. `compactRupees`) */
  axisFormat?: (value: number) => string;
  orientation?: "vertical" | "horizontal";
  /** vertical only */
  height?: number;
  className?: string;
}

const CHAR_W = 6.4;

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`;
}

/** Bars from a zero baseline. Direct value labels on every bar when they fit, else on the highlighted and tallest. */
export function BarSeries({ data, summary, format = compact, axisFormat = compact, orientation = "vertical", height = 220, className }: BarSeriesProps) {
  const [ref, w] = useWidth<HTMLDivElement>(480);
  const n = data.length;
  const maxV = Math.max(0, ...data.map((d) => d.value));
  const peak = data.findIndex((d) => d.value === maxV);

  if (orientation === "horizontal") {
    const rowH = 30;
    const barH = 18;
    const labelW = Math.min(Math.round(w * 0.38), 170);
    const valueW = Math.max(...data.map((d) => format(d.value).length), 3) * CHAR_W + 8;
    const plotW = Math.max(40, w - labelW - valueW - 8);
    const h = n * rowH + 4;
    const scale = maxV > 0 ? plotW / maxV : 0;
    return (
      <div ref={ref} className={cx("chart", className)}>
        <svg role="img" aria-label={summary} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <line x1={labelW} x2={labelW} y1={0} y2={h} className="c-base" />
          {data.map((d, i) => {
            const y = i * rowH + (rowH - barH) / 2;
            const bw = Math.max(d.value > 0 ? 2 : 0, d.value * scale);
            return (
              <g key={`${d.label}-${i}`}>
                <title>{`${d.label}: ${format(d.value)}`}</title>
                <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" className="c-ink">
                  {clip(d.label, Math.floor((labelW - 8) / CHAR_W))}
                </text>
                <rect x={labelW} y={y} width={bw} height={barH} rx={0} className={d.highlight ? "c-s2" : "c-s1"} />
                <text x={labelW + bw + 6} y={y + barH / 2 + 4} className="c-strong">
                  {format(d.value)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  const top = 20;
  const bottom = 24;
  const { max, step } = niceMax(maxV, 4);
  const ticks = tickValues(max, step);
  const axisW = Math.max(...ticks.map((t) => axisFormat(t).length), 2) * CHAR_W + 10;
  const plotW = Math.max(40, w - axisW - 4);
  const plotH = height - top - bottom;
  const slot = n > 0 ? plotW / n : plotW;
  const barW = Math.max(2, Math.min(24, slot - Math.min(4, slot * 0.3)));
  const y = (v: number) => top + plotH - (max > 0 ? (v / max) * plotH : 0);
  const labelAll = n > 0 && slot >= Math.max(...data.map((d) => format(d.value).length), 3) * CHAR_W + 4;
  const showX = labelIndices(n, plotW, 52);

  return (
    <div ref={ref} className={cx("chart", className)}>
      <svg role="img" aria-label={summary} width={w} height={height} viewBox={`0 0 ${w} ${height}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={axisW} x2={w} y1={y(t)} y2={y(t)} className={t === 0 ? "c-base" : "c-grid"} />
            <text x={axisW - 8} y={y(t) + 4} textAnchor="end">
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = axisW + i * slot + (slot - barW) / 2;
          const h = Math.max(d.value > 0 ? 2 : 0, (d.value / (max || 1)) * plotH);
          const labelled = labelAll || d.highlight || i === peak;
          return (
            <g key={`${d.label}-${i}`}>
              <title>{`${d.label}: ${format(d.value)}`}</title>
              <rect x={x} y={top + plotH - h} width={barW} height={h} rx={0} className={d.highlight ? "c-s2" : "c-s1"} />
              {labelled && d.value > 0 ? (
                <text x={x + barW / 2} y={top + plotH - h - 5} textAnchor="middle" className="c-strong">
                  {format(d.value)}
                </text>
              ) : null}
              {showX.has(i) ? (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle">
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
