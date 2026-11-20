import { useRef, type ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { useL } from "@/lib/ui/lang";
import { ChartHint, Live, Tip, useActiveMark } from "./chart-kit";

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
  /** a plain sentence under the chart: what it shows and how to read it */
  hint?: ReactNode;
  /** what the hovered part means */
  explain?: (s: StackSegment, i: number) => string | undefined;
  className?: string;
}

const ORDER: StackTone[] = ["s4", "s3", "s2", "s1"];

/** Parts of a whole as one horizontal bar with a ruled key of label, amount and share under it (khata ageing). */
export function StackedBar({
  segments,
  summary,
  format,
  height = 28,
  hint,
  explain,
  className,
}: StackedBarProps) {
  const l = useL();
  const ref = useRef<HTMLDivElement | null>(null);
  const { active, bind, onKeyDown } = useActiveMark(segments.length, ref);
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const toned = segments.map((s, i) => ({
    ...s,
    tone: s.tone ?? ORDER[Math.min(i, ORDER.length - 1)],
  }));

  const starts = toned.map((_, i) =>
    total > 0
      ? toned
          .slice(0, i)
          .reduce((a, x) => a + (Math.max(0, x.value) / total) * 100, 0)
      : 0,
  );
  const at = active === null ? null : toned[active];
  const share =
    at && total > 0 ? Math.round((Math.max(0, at.value) / total) * 100) : 0;
  const extra = at && active !== null ? explain?.(at, active) : undefined;
  const tipLines = at
    ? [
        l(`${share}% of the total`, `कुल का ${share}%`, `Kul ka ${share}%`),
        ...(extra ? [extra] : []),
      ]
    : [];

  return (
    <div ref={ref} className={cx("chart", className)}>
      <div
        tabIndex={0}
        role="group"
        aria-label={`${summary} ${l("Use the arrow keys to move between parts.", "हिस्सों के बीच जाने के लिए तीर वाली कुंजियाँ दबाएँ।", "Hisson ke beech jaane ke liye arrow keys dabao.")}`}
        onKeyDown={onKeyDown}
        className="chart-focus"
      >
        <svg
          role="img"
          aria-label={summary}
          width="100%"
          height={height}
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
        >
          {total > 0 ? (
            toned.map((s, i) => {
              const w = (Math.max(0, s.value) / total) * 100;
              const x = starts[i];
              return w > 0 ? (
                <rect
                  key={s.label}
                  x={x}
                  y={0}
                  width={w}
                  height={height}
                  className={cx(
                    `c-${s.tone}`,
                    "c-gap",
                    active !== null && active !== i && "c-dim",
                    active === i && "c-on",
                  )}
                  {...bind(i)}
                />
              ) : null;
            })
          ) : (
            <rect x={0} y={0} width={100} height={height} className="c-s4" />
          )}
        </svg>
      </div>
      {at && active !== null ? (
        <div
          className="ct-box"
          style={{
            left: `${starts[active] + (total > 0 ? (Math.max(0, at.value) / total) * 50 : 0)}%`,
          }}
        >
          <Tip
            x={0}
            y={-2}
            boxW={0}
            title={at.label}
            value={format(at.value)}
            lines={tipLines}
          />
        </div>
      ) : null}
      <Live
        text={
          at ? `${at.label}: ${format(at.value)}. ${tipLines.join(". ")}` : ""
        }
      />
      <dl className="chart-list">
        {toned.map((s, i) => (
          <div
            key={s.label}
            data-on={active === i ? "" : undefined}
            {...bind(i)}
          >
            <span className={`chart-swatch sw-${s.tone}`} aria-hidden="true" />
            <dt>{s.label}</dt>
            <dd className="num">{format(s.value)}</dd>
            <dd className="num">
              {total > 0
                ? `${Math.round((Math.max(0, s.value) / total) * 100)}%`
                : ""}
            </dd>
          </div>
        ))}
      </dl>
      {hint ? <ChartHint>{hint}</ChartHint> : null}
    </div>
  );
}
