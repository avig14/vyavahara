"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { useL } from "@/lib/ui/lang";
import { ChartHint, Live, Tip, useActiveMark } from "./chart-kit";
import { compact, labelIndices, linePath, niceMax, tickValues } from "./scale";
import { useWidth } from "./use-width";

export interface LinePoint {
  label: string;
  /** observed value; omit (or null) for days that have not happened */
  actual?: number | null;
  forecast?: number | null;
  /** confidence band around the forecast */
  low?: number | null;
  high?: number | null;
}

export interface LineBandProps {
  points: readonly LinePoint[];
  summary: string;
  format?: (value: number) => string;
  axisFormat?: (value: number) => string;
  actualLabel?: string;
  forecastLabel?: string;
  bandLabel?: string;
  height?: number;
  /** a plain sentence under the chart: what it shows and how to read it */
  hint?: ReactNode;
  /** what the hovered point means, added under the numbers */
  explain?: (p: LinePoint, i: number) => string | undefined;
  className?: string;
}

const CHAR_W = 6.4;

const has = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Actual as a solid navy line, forecast as a dashed cyan line, the confidence band as a pale wash. Labelled in place. */
export function LineBand({
  points,
  summary,
  format = compact,
  axisFormat = compact,
  actualLabel = "Actual",
  forecastLabel = "Forecast",
  bandLabel = "Likely range",
  height = 240,
  hint,
  explain,
  className,
}: LineBandProps) {
  const l = useL();
  const [ref, w] = useWidth<HTMLDivElement>(560);
  const n = points.length;
  const { active, bind, onKeyDown } = useActiveMark(n, ref);
  const vals = points
    .flatMap((p) => [p.actual, p.forecast, p.low, p.high])
    .filter(has);
  const maxV = Math.max(0, ...vals);
  const minV = Math.min(0, ...vals);

  const top = 28;
  const bottom = 24;
  const { step } = niceMax(Math.max(maxV, -minV, 1), 4);
  const hi = Math.ceil(maxV / step) * step || step;
  const lo = Math.floor(minV / step) * step;
  const ticks = tickValues(hi - lo, step).map((t) => t + lo);
  const axisW =
    Math.max(...ticks.map((t) => axisFormat(t).length), 2) * CHAR_W + 10;
  const rightPad = 12;
  const plotW = Math.max(40, w - axisW - rightPad);
  const plotH = height - top - bottom;
  const x = (i: number) => axisW + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const y = (v: number) => top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

  const actualPts: [number, number][] = [];
  let lastActual = -1;
  points.forEach((p, i) => {
    if (has(p.actual)) {
      actualPts.push([x(i), y(p.actual)]);
      lastActual = i;
    }
  });

  const forecastPts: [number, number][] = [];
  const firstForecast = points.findIndex((p) => has(p.forecast));
  let lastForecastIdx = -1;
  if (firstForecast > 0 && lastActual === firstForecast - 1) {
    const a = points[lastActual].actual;
    if (has(a)) forecastPts.push([x(lastActual), y(a)]);
  }
  points.forEach((p, i) => {
    if (has(p.forecast)) {
      forecastPts.push([x(i), y(p.forecast)]);
      lastForecastIdx = i;
    }
  });

  const band = points
    .map((p, i) => ({ i, low: p.low, high: p.high }))
    .filter(
      (b): b is { i: number; low: number; high: number } =>
        has(b.low) && has(b.high),
    );
  const bandPath =
    band.length > 1
      ? `${linePath(band.map((b) => [x(b.i), y(b.high)]))} ${band
          .slice()
          .reverse()
          .map((b) => `L${x(b.i).toFixed(1)} ${y(b.low).toFixed(1)}`)
          .join(" ")} Z`
      : null;

  const showX = labelIndices(n, plotW, 64);
  const lastA = lastActual >= 0 ? points[lastActual].actual : null;
  const lastF = lastForecastIdx >= 0 ? points[lastForecastIdx].forecast : null;
  const aMid = actualPts.length
    ? actualPts[Math.floor(actualPts.length / 2)]
    : null;
  const fOnly = forecastPts.length > 1 ? forecastPts.slice(1) : forecastPts;
  const fMid = fOnly.length ? fOnly[Math.floor(fOnly.length / 2)] : null;
  const bandTop = band.length ? Math.min(...band.map((b) => y(b.high))) : null;

  const primary = (p: LinePoint) =>
    has(p.actual) ? p.actual : has(p.forecast) ? p.forecast : null;
  const tipFor = (i: number) => {
    const p = points[i];
    const lines: string[] = [];
    if (has(p.actual)) lines.push(`${actualLabel}: ${format(p.actual)}`);
    if (has(p.forecast)) lines.push(`${forecastLabel}: ${format(p.forecast)}`);
    if (has(p.low) && has(p.high))
      lines.push(
        `${bandLabel}: ${format(p.low)} ${l("to", "से", "se")} ${format(p.high)}`,
      );
    const v = primary(p);
    const prev = i > 0 ? primary(points[i - 1]) : null;
    if (v !== null && prev !== null) {
      const d = v - prev;
      lines.push(
        d === 0
          ? l(
              `Same as ${points[i - 1].label}`,
              `${points[i - 1].label} जितना ही`,
              `${points[i - 1].label} jitna hi`,
            )
          : l(
              `${format(Math.abs(d))} ${d > 0 ? "up" : "down"} from ${points[i - 1].label}`,
              `${points[i - 1].label} से ${format(Math.abs(d))} ${d > 0 ? "ऊपर" : "नीचे"}`,
              `${points[i - 1].label} se ${format(Math.abs(d))} ${d > 0 ? "upar" : "neeche"}`,
            ),
      );
    }
    if (v !== null && v < 0)
      lines.push(l("Below zero", "शून्य से नीचे", "Zero se neeche"));
    const extra = explain?.(p, i);
    if (extra) lines.push(extra);
    return { title: p.label, lines };
  };
  const activeTip = active !== null && points[active] ? tipFor(active) : null;

  return (
    <div ref={ref} className={cx("chart", className)}>
      <div
        tabIndex={0}
        role="group"
        aria-label={`${summary} ${l("Use the arrow keys to move along the line.", "लाइन पर चलने के लिए तीर वाली कुंजियाँ दबाएँ।", "Line par chalne ke liye arrow keys dabao.")}`}
        onKeyDown={onKeyDown}
        className="chart-focus"
      >
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
                x2={w - rightPad}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? "c-base" : "c-grid"}
              />
              <text x={axisW - 8} y={y(t) + 4} textAnchor="end">
                {axisFormat(t)}
              </text>
            </g>
          ))}
          {forecastPts.length > 0 && lastActual >= 0 ? (
            <line
              x1={x(lastActual)}
              x2={x(lastActual)}
              y1={top - 8}
              y2={top + plotH}
              className="c-divider"
            />
          ) : null}
          {bandPath ? (
            <path d={bandPath} className="c-band">
              <title>{bandLabel}</title>
            </path>
          ) : null}
          {actualPts.length > 1 ? (
            <path d={linePath(actualPts)} className="l-s1" />
          ) : null}
          {forecastPts.length > 1 ? (
            <path d={linePath(forecastPts)} className="l-s2 l-dash" />
          ) : null}
          {has(lastA) ? (
            <g>
              <circle
                cx={x(lastActual)}
                cy={y(lastA)}
                r={3.5}
                className="c-dot-s1"
              />
              <text
                x={x(lastActual) - 8}
                y={y(lastA) - 9}
                textAnchor="end"
                className="c-strong"
              >
                {format(lastA)}
              </text>
            </g>
          ) : null}
          {has(lastF) ? (
            <g>
              <circle
                cx={x(lastForecastIdx)}
                cy={y(lastF)}
                r={3.5}
                className="c-dot-s2"
              />
              <text
                x={x(lastForecastIdx)}
                y={y(lastF) + 18}
                textAnchor="end"
                className="c-strong"
              >
                {format(lastF)}
              </text>
            </g>
          ) : null}
          {aMid ? (
            <text
              x={aMid[0]}
              y={Math.max(14, aMid[1] - 16)}
              textAnchor="middle"
            >
              {actualLabel}
            </text>
          ) : null}
          {fMid ? (
            <text
              x={w - rightPad}
              y={Math.max(14, (bandTop ?? fMid[1]) - 8)}
              textAnchor="end"
            >
              {band.length
                ? `${forecastLabel} and ${bandLabel.toLowerCase()}`
                : forecastLabel}
            </text>
          ) : null}
          {points.map((p, i) =>
            showX.has(i) ? (
              <text
                key={`${p.label}-${i}`}
                x={x(i)}
                y={height - 6}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              >
                {p.label}
              </text>
            ) : null,
          )}
          {active !== null && points[active] ? (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={top - 8}
              y2={top + plotH}
              className="c-cross"
            />
          ) : null}
          {active !== null && points[active] && has(points[active].actual) ? (
            <circle
              cx={x(active)}
              cy={y(points[active].actual as number)}
              r={5}
              className="c-dot-s1"
            />
          ) : null}
          {active !== null && points[active] && has(points[active].forecast) ? (
            <circle
              cx={x(active)}
              cy={y(points[active].forecast as number)}
              r={5}
              className="c-dot-s2"
            />
          ) : null}
          {points.map((_, i) => {
            const half = n > 1 ? plotW / (n - 1) / 2 : plotW / 2;
            return (
              <rect
                key={i}
                x={x(i) - half}
                y={top - 8}
                width={half * 2}
                height={plotH + 8 + bottom}
                fill="transparent"
                {...bind(i)}
              />
            );
          })}
        </svg>
      </div>
      {activeTip && active !== null ? (
        <Tip
          x={x(active) + (active < n / 2 ? 1 : -1) * 116}
          y={top + 6}
          boxW={w}
          title={activeTip.title}
          lines={activeTip.lines}
        />
      ) : null}
      <Live
        text={
          activeTip ? `${activeTip.title}. ${activeTip.lines.join(". ")}` : ""
        }
      />
      {hint ? <ChartHint>{hint}</ChartHint> : null}
    </div>
  );
}
