"use client";

import { cx } from "@/lib/ui/cx";
import { useWidth } from "./use-width";

export interface HeatmapProps {
  /** 7 rows (Sunday first, as the API sends them) of 24 hourly values */
  cells: readonly (readonly number[])[];
  summary: string;
  format?: (value: number) => string;
  /** first day shown, 0 = Sunday ... 6 = Saturday; default Monday */
  startDay?: number;
  /** hours shown; default is the span that has any value, at least 8 hours */
  hours?: readonly [from: number, to: number];
  cellHeight?: number;
  className?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hourLabel(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

function activeSpan(cells: readonly (readonly number[])[]): [number, number] {
  let from = 24;
  let to = -1;
  for (const row of cells)
    row.forEach((v, h) => {
      if (v > 0) {
        from = Math.min(from, h);
        to = Math.max(to, h);
      }
    });
  if (to < 0) return [8, 20];
  while (to - from < 7) {
    if (from > 0) from -= 1;
    if (to - from < 7 && to < 23) to += 1;
  }
  return [from, to];
}

/** Day by hour grid shaded in one navy ramp. The busiest cell is outlined. */
export function Heatmap({ cells, summary, format = (v) => String(Math.round(v)), startDay = 1, hours, cellHeight = 22, className }: HeatmapProps) {
  const [ref, w] = useWidth<HTMLDivElement>(480);
  const [h0, h1] = hours ?? activeSpan(cells);
  const cols = h1 - h0 + 1;
  const labelW = 34;
  const gap = 2;
  const cw = Math.max(6, (w - labelW) / cols);
  const topPad = 18;
  const h = topPad + 7 * cellHeight;
  const days = Array.from({ length: 7 }, (_, i) => (startDay + i) % 7);
  const max = Math.max(0, ...cells.flat());
  let peakRow = -1;
  let peakHour = -1;
  if (max > 0)
    days.forEach((d, r) => {
      for (let hr = h0; hr <= h1; hr++)
        if (cells[d]?.[hr] === max) {
          peakRow = r;
          peakHour = hr;
        }
    });
  const labelEvery = cw >= 36 ? 1 : cw >= 20 ? 2 : 3;

  return (
    <div ref={ref} className={cx("chart", className)}>
      <svg role="img" aria-label={summary} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {Array.from({ length: cols }, (_, c) => {
          const hr = h0 + c;
          return c % labelEvery === 0 ? (
            <text key={hr} x={labelW + c * cw + (cw - gap) / 2} y={11} textAnchor="middle">
              {hourLabel(hr)}
            </text>
          ) : null;
        })}
        {days.map((d, r) => (
          <g key={d}>
            <text x={0} y={topPad + r * cellHeight + cellHeight / 2 + 4}>
              {DAYS[d]}
            </text>
            {Array.from({ length: cols }, (_, c) => {
              const hr = h0 + c;
              const v = cells[d]?.[hr] ?? 0;
              const t = max > 0 ? Math.max(0, v) / max : 0;
              const fill = v > 0 ? `color-mix(in oklab, var(--color-navy) ${Math.round(14 + 86 * Math.sqrt(t))}%, var(--color-paper-3))` : "var(--color-paper-3)";
              return (
                <rect key={hr} x={labelW + c * cw} y={topPad + r * cellHeight} width={cw - gap} height={cellHeight - gap} rx={2} style={{ fill }}>
                  <title>{`${DAYS[d]} ${hourLabel(hr)}: ${format(v)}`}</title>
                </rect>
              );
            })}
          </g>
        ))}
        {peakRow >= 0 ? (
          <rect x={labelW + (peakHour - h0) * cw - 1} y={topPad + peakRow * cellHeight - 1} width={cw - gap + 2} height={cellHeight - gap + 2} rx={3} className="c-peak" />
        ) : null}
      </svg>
    </div>
  );
}
