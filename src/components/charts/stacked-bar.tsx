import { cx } from "@/lib/ui/cx";

export type StackTone = "s1" | "s2" | "s3" | "s4" | "warn" | "danger";

export interface StackSegment {
  label: string;
  value: number;
  /** defaults follow the series order; use warn/danger only for overdue money */
  tone?: StackTone;
}

export interface StackedBarProps {
  segments: readonly StackSegment[];
  summary: string;
  /** exact value text (e.g. `rupees`) */
  format: (value: number) => string;
  height?: number;
  className?: string;
}

const ORDER: StackTone[] = ["s4", "s3", "s2", "s1"];

/** Parts of a whole as one horizontal bar with a ruled key of label, amount and share under it (khata ageing). */
export function StackedBar({ segments, summary, format, height = 28, className }: StackedBarProps) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const toned = segments.map((s, i) => ({ ...s, tone: s.tone ?? ORDER[Math.min(i, ORDER.length - 1)] }));
  let acc = 0;

  return (
    <div className={cx("chart", className)}>
      <svg role="img" aria-label={summary} width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {total > 0 ? (
          toned.map((s) => {
            const w = (Math.max(0, s.value) / total) * 100;
            const x = acc;
            acc += w;
            return w > 0 ? (
              <rect key={s.label} x={x} y={0} width={w} height={height} className={`c-${s.tone} c-gap`}>
                <title>{`${s.label}: ${format(s.value)}`}</title>
              </rect>
            ) : null;
          })
        ) : (
          <rect x={0} y={0} width={100} height={height} className="c-s4" />
        )}
      </svg>
      <dl className="chart-list">
        {toned.map((s) => (
          <div key={s.label}>
            <span className={`chart-swatch sw-${s.tone}`} aria-hidden="true" />
            <dt>{s.label}</dt>
            <dd className="num">{format(s.value)}</dd>
            <dd className="num">{total > 0 ? `${Math.round((Math.max(0, s.value) / total) * 100)}%` : ""}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
