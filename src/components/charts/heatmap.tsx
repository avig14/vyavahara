"use client";

import type { ReactNode } from "react";
import { dayName, HI_DAYS_FULL, isHindi } from "@/lib/ui/dlang";
import { useL } from "@/lib/ui/lang";
import { ChartHint, Live, Tip, useActiveMark } from "./chart-kit";
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
  /** a plain sentence under the chart: what it shows and how to read it */
  hint?: ReactNode;
  className?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const fullDay = (d: number) => (isHindi() ? HI_DAYS_FULL[d] : DAYS_FULL[d]);

function hourLong(h: number): string {
  const h12 = h % 12 || 12;
  return `${h12} ${isHindi() ? (h >= 12 ? "अपराह्न" : "पूर्वाह्न") : h >= 12 ? "pm" : "am"}`;
}

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
export function Heatmap({
  cells,
  summary,
  format = (v) => String(Math.round(v)),
  startDay = 1,
  hours,
  cellHeight = 22,
  hint,
  className,
}: HeatmapProps) {
  const l = useL();
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
  const { active, bind, onKeyDown } = useActiveMark(7 * cols, ref);
  const ar = active === null ? -1 : Math.floor(active / cols);
  const ac = active === null ? -1 : active % cols;
  const tip = (() => {
    if (active === null) return null;
    const d = days[ar];
    const hr = h0 + ac;
    const v = cells[d]?.[hr] ?? 0;
    const lines: string[] = [];
    if (v <= 0)
      lines.push(
        l(
          "No sales recorded in this hour",
          "इस घंटे कोई बिक्री दर्ज नहीं",
          "Is ghante koi bikri darj nahi",
        ),
      );
    else if (max > 0) {
      const pct = Math.round((v / max) * 100);
      lines.push(
        pct === 100
          ? l(
              "The busiest hour of the week",
              "हफ़्ते का सबसे व्यस्त घंटा",
              "Hafte ka sabse vyast ghanta",
            )
          : l(
              `${pct}% of the busiest hour`,
              `सबसे व्यस्त घंटे का ${pct}%`,
              `Sabse vyast ghante ka ${pct}%`,
            ),
      );
    }
    return {
      title: `${fullDay(d)}, ${hourLong(hr)}`,
      value: format(v),
      lines,
      x:
        labelW +
        ac * cw +
        (cw - gap) / 2 +
        (ac < cols / 2 ? 1 : -1) * (cw / 2 + 116),
      y: topPad + 4,
    };
  })();

  return (
    <div ref={ref} className={cx("chart", className)}>
      <div
        tabIndex={0}
        role="group"
        aria-label={`${summary} ${l("Use the arrow keys to move across the cells.", "खानों में चलने के लिए तीर वाली कुंजियाँ दबाएँ।", "Khaano mein chalne ke liye arrow keys dabao.")}`}
        onKeyDown={onKeyDown}
        className="chart-focus"
      >
        <svg
          role="img"
          aria-label={summary}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
        >
          {Array.from({ length: cols }, (_, c) => {
            const hr = h0 + c;
            return c % labelEvery === 0 ? (
              <text
                key={hr}
                x={labelW + c * cw + (cw - gap) / 2}
                y={11}
                textAnchor="middle"
              >
                {hourLabel(hr)}
              </text>
            ) : null;
          })}
          {days.map((d, r) => (
            <g key={d}>
              <text x={0} y={topPad + r * cellHeight + cellHeight / 2 + 4}>
                {dayName(d, DAYS)}
              </text>
              {Array.from({ length: cols }, (_, c) => {
                const hr = h0 + c;
                const v = cells[d]?.[hr] ?? 0;
                const t = max > 0 ? Math.max(0, v) / max : 0;
                const fill =
                  v > 0
                    ? `color-mix(in oklab, var(--color-navy) ${Math.round(14 + 86 * Math.sqrt(t))}%, var(--color-paper-3))`
                    : "var(--color-paper-3)";
                return (
                  <rect
                    key={hr}
                    x={labelW + c * cw}
                    y={topPad + r * cellHeight}
                    width={cw - gap}
                    height={cellHeight - gap}
                    rx={2}
                    style={{ fill }}
                    className={
                      active !== null && active !== r * cols + c
                        ? r === ar || c === ac
                          ? undefined
                          : "c-dim-soft"
                        : undefined
                    }
                    {...bind(r * cols + c)}
                  />
                );
              })}
            </g>
          ))}
          {peakRow >= 0 ? (
            <rect
              x={labelW + (peakHour - h0) * cw - 1}
              y={topPad + peakRow * cellHeight - 1}
              width={cw - gap + 2}
              height={cellHeight - gap + 2}
              rx={3}
              className="c-peak"
            />
          ) : null}
          {active !== null ? (
            <rect
              x={labelW + ac * cw - 1}
              y={topPad + ar * cellHeight - 1}
              width={cw - gap + 2}
              height={cellHeight - gap + 2}
              rx={3}
              className="c-hover"
              pointerEvents="none"
            />
          ) : null}
        </svg>
      </div>
      {tip ? (
        <Tip
          x={tip.x}
          y={tip.y}
          boxW={w}
          title={tip.title}
          value={tip.value}
          lines={tip.lines}
        />
      ) : null}
      <Live
        text={tip ? `${tip.title}: ${tip.value}. ${tip.lines.join(". ")}` : ""}
      />
      <div className="hm-legend" aria-hidden="true">
        <span>{l("Quiet", "शांत", "Shaant")}</span>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <i
            key={t}
            style={{
              background: `color-mix(in oklab, var(--color-navy) ${Math.round(14 + 86 * Math.sqrt(t))}%, var(--color-paper-3))`,
            }}
          />
        ))}
        <span>{l("Busy", "व्यस्त", "Vyast")}</span>
      </div>
      {hint ? <ChartHint>{hint}</ChartHint> : null}
    </div>
  );
}
