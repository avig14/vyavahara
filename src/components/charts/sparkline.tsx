"use client";

import { cx } from "@/lib/ui/cx";
import { linePath } from "./scale";
import { useWidth } from "./use-width";

export interface SparklineProps {
  values: readonly number[];
  /** one sentence a screen reader gets instead of the picture */
  summary: string;
  height?: number;
  /** fixed width in px; omit to fill the container */
  width?: number;
  tone?: "navy" | "cyan" | "muted";
  className?: string;
}

const LINE = { navy: "l-s1", cyan: "l-s2", muted: "l-s3" } as const;
const DOT = { navy: "c-dot-s1", cyan: "c-dot-s2", muted: "c-s3" } as const;

/** Axis-free trend line that rides inside a row or a stat: one stroke, one end dot. */
export function Sparkline({ values, summary, height = 32, width, tone = "navy", className }: SparklineProps) {
  const [ref, measured] = useWidth<HTMLSpanElement>(96);
  const w = width ?? measured;
  const pad = 4;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const n = values.length;
  const pts = values.map((v, i): [number, number] => [pad + (n > 1 ? (i / (n - 1)) * (w - 2 * pad) : (w - 2 * pad) / 2), height - pad - ((v - lo) / span) * (height - 2 * pad)]);
  const end = pts[pts.length - 1];

  return (
    <span ref={ref} className={cx("chart", className)} style={{ display: "block", width: width ? `${width}px` : "100%" }}>
      <svg role="img" aria-label={summary} width={w} height={height} viewBox={`0 0 ${w} ${height}`}>
        {n > 1 ? <path d={linePath(pts)} className={LINE[tone]} /> : null}
        {end ? <circle cx={end[0]} cy={end[1]} r={3} className={DOT[tone]} /> : null}
      </svg>
    </span>
  );
}
