"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { useL } from "@/lib/ui/lang";
import { ChartHint, Live, Tip, compareLines, useActiveMark } from "./chart-kit";
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
  /** a plain sentence under the chart: what it shows and how to read it */
  hint?: ReactNode;
  /** extra meaning for the hovered bar, added under the standard comparison lines */
  explain?: (d: BarDatum, i: number) => string | undefined;
  className?: string;
}

const CHAR_W = 6.4;

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`;
}

/** Bars from a zero baseline. Hover, tap or arrow keys open a readout with the exact value and how it compares. */
export function BarSeries({
  data,
  summary,
  format = compact,
  axisFormat = compact,
  orientation = "vertical",
  height = 220,
  hint,
  explain,
  className,
}: BarSeriesProps) {
  const l = useL();
  const [ref, w] = useWidth<HTMLDivElement>(480);
  const n = data.length;
  const { active, bind, onKeyDown } = useActiveMark(n, ref);
  const values = data.map((d) => d.value);
  const labels = data.map((d) => d.label);
  const maxV = Math.max(0, ...values);
  const peak = data.findIndex((d) => d.value === maxV);

  const tipFor = (
    i: number,
  ): { title: string; value: string; lines: string[] } => {
    const extra = explain?.(data[i], i);
    return {
      title: data[i].label,
      value: format(data[i].value),
      lines: [
        ...compareLines(values, labels, i, format, l),
        ...(extra ? [extra] : []),
      ],
    };
  };
  const activeTip = active !== null && data[active] ? tipFor(active) : null;
  const live = activeTip
    ? `${activeTip.title}: ${activeTip.value}. ${activeTip.lines.join(". ")}`
    : "";
  const cls = (i: number, base: string) =>
    cx(
      base,
      active !== null && active !== i && "c-dim",
      active === i && "c-on",
    );

  const wrap = (svg: ReactNode, tip: ReactNode) => (
    <div ref={ref} className={cx("chart", className)}>
      <div
        tabIndex={0}
        role="group"
        aria-label={`${summary} ${l("Use the arrow keys to move between bars.", "बार के बीच जाने के लिए तीर वाली कुंजियाँ दबाएँ।", "Bars ke beech jaane ke liye arrow keys dabao.")}`}
        onKeyDown={onKeyDown}
        className="chart-focus"
      >
        {svg}
      </div>
      {tip}
      <Live text={live} />
      {hint ? <ChartHint>{hint}</ChartHint> : null}
    </div>
  );

  if (orientation === "horizontal") {
    const rowH = 30;
    const barH = 18;
    const labelW = Math.min(Math.round(w * 0.38), 170);
    const valueW =
      Math.max(...data.map((d) => format(d.value).length), 3) * CHAR_W + 8;
    const plotW = Math.max(40, w - labelW - valueW - 8);
    const h = n * rowH + 4;
    const scale = maxV > 0 ? plotW / maxV : 0;
    return wrap(
      <svg
        role="img"
        aria-label={summary}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
      >
        <line x1={labelW} x2={labelW} y1={0} y2={h} className="c-base" />
        {data.map((d, i) => {
          const y = i * rowH + (rowH - barH) / 2;
          const bw = Math.max(d.value > 0 ? 2 : 0, d.value * scale);
          return (
            <g key={`${d.label}-${i}`} {...bind(i)}>
              <rect
                x={0}
                y={i * rowH}
                width={w}
                height={rowH}
                fill="transparent"
              />
              <text
                x={labelW - 8}
                y={y + barH / 2 + 4}
                textAnchor="end"
                className="c-ink"
              >
                {clip(d.label, Math.floor((labelW - 8) / CHAR_W))}
              </text>
              <rect
                x={labelW}
                y={y}
                width={bw}
                height={barH}
                rx={0}
                className={cls(i, d.highlight ? "c-s2" : "c-s1")}
              />
              <text
                x={labelW + bw + 6}
                y={y + barH / 2 + 4}
                className="c-strong"
              >
                {format(d.value)}
              </text>
            </g>
          );
        })}
      </svg>,
      active !== null && activeTip ? (
        <Tip
          x={labelW + Math.max(2, data[active].value * scale) / 2 + 20}
          y={active * rowH + 4}
          boxW={w}
          {...activeTip}
        />
      ) : null,
    );
  }

  const top = 20;
  const bottom = 24;
  const { max, step } = niceMax(maxV, 4);
  const ticks = tickValues(max, step);
  const axisW =
    Math.max(...ticks.map((t) => axisFormat(t).length), 2) * CHAR_W + 10;
  const plotW = Math.max(40, w - axisW - 4);
  const plotH = height - top - bottom;
  const slot = n > 0 ? plotW / n : plotW;
  const barW = Math.max(2, Math.min(24, slot - Math.min(4, slot * 0.3)));
  const y = (v: number) => top + plotH - (max > 0 ? (v / max) * plotH : 0);
  const labelAll =
    n > 0 &&
    slot >=
      Math.max(...data.map((d) => format(d.value).length), 3) * CHAR_W + 4;
  const showX = labelIndices(n, plotW, 52);

  return wrap(
    <svg
      role="img"
      aria-label={summary}
      width={w}
      height={height}
      viewBox={`0 0 ${w} ${height}`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={axisW}
            x2={w}
            y1={y(t)}
            y2={y(t)}
            className={t === 0 ? "c-base" : "c-grid"}
          />
          <text x={axisW - 8} y={y(t) + 4} textAnchor="end">
            {axisFormat(t)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = axisW + i * slot + (slot - barW) / 2;
        const h = Math.max(d.value > 0 ? 2 : 0, (d.value / (max || 1)) * plotH);
        const labelled = labelAll || d.highlight || i === peak || active === i;
        return (
          <g key={`${d.label}-${i}`} {...bind(i)}>
            <rect
              x={axisW + i * slot}
              y={top}
              width={slot}
              height={plotH + bottom}
              fill="transparent"
            />
            <rect
              x={x}
              y={top + plotH - h}
              width={barW}
              height={h}
              rx={0}
              className={cx(cls(i, d.highlight ? "c-s2" : "c-s1"), "c-grow")}
            />
            {labelled && d.value > 0 ? (
              <text
                x={x + barW / 2}
                y={top + plotH - h - 5}
                textAnchor="middle"
                className={cx(
                  "c-strong",
                  active !== null && active !== i && "c-dim",
                )}
              >
                {format(d.value)}
              </text>
            ) : null}
            {showX.has(i) || active === i ? (
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                className={active === i ? "c-strong" : undefined}
              >
                {d.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>,
    active !== null && activeTip ? (
      <Tip
        x={
          axisW +
          active * slot +
          slot / 2 +
          (active < n / 2 ? 1 : -1) * (slot / 2 + 116)
        }
        y={top + 6}
        boxW={w}
        {...activeTip}
      />
    ) : null,
  );
}
