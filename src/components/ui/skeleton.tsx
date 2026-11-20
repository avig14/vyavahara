"use client";
import type { CSSProperties } from "react";
import { useL } from "@/lib/ui/lang";
import { cx } from "@/lib/ui/cx";

interface BoxProps {
  className?: string;
  style?: CSSProperties;
}

/** One grey line of text. */
export function SkeletonLine({ width = "100%", className }: { width?: string; className?: string }) {
  return <span aria-hidden="true" className={cx("skel skel-line", className)} style={{ width }} />;
}

/** A solid block (a chart area, an image). */
export function SkeletonBlock({ height = "12rem", className, style }: BoxProps & { height?: string }) {
  return <span aria-hidden="true" className={cx("skel", className)} style={{ height, ...style }} />;
}

/** Table-shaped: `rows` ruled rows of `cols` cells; the first cell is wider, the last is a number. */
export function SkeletonRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  const template = `${cols > 1 ? "minmax(0, 2fr) " : ""}${Array.from({ length: Math.max(0, cols - 1) }, () => "minmax(0, 1fr)").join(" ")}`.trim();
  return (
    <div aria-hidden="true" className="skel-rows">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="skel-row" style={{ gridTemplateColumns: template }}>
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonLine key={c} width={c === 0 ? `${62 + ((r * 13) % 30)}%` : `${48 + ((r * 7 + c * 11) % 36)}%`} className={c === cols - 1 && cols > 1 ? "skel-end" : undefined} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A figure with its label, in the shape of Stat. */
export function SkeletonStat() {
  return (
    <div aria-hidden="true" className="skel-stat">
      <SkeletonLine width="45%" />
      <span className="skel" style={{ height: "1.9rem", width: "70%" }} />
    </div>
  );
}

export type SkeletonShape = "line" | "block" | "rows" | "stat";

export interface SkeletonProps {
  shape: SkeletonShape;
  /** rows and stat shapes: how many */
  count?: number;
  cols?: number;
  height?: string;
  /** announced to screen readers; default "Loading" */
  label?: string;
}

/** Placeholder in the shape of what is loading. Announces itself once; the grey shapes are hidden from readers. */
export function Skeleton({ shape, count, cols, height, label }: SkeletonProps) {
  const l = useL();
  label ??= l("Loading", "लोड हो रहा है", "Load ho raha hai");
  let body;
  if (shape === "line") body = <SkeletonLine />;
  else if (shape === "block") body = <SkeletonBlock height={height} />;
  else if (shape === "rows") body = <SkeletonRows rows={count} cols={cols} />;
  else
    body = (
      <div className="stats">
        {Array.from({ length: count ?? 4 }, (_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>
    );
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {body}
    </div>
  );
}
