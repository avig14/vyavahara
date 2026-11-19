import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

export type StatTone = "neutral" | "success" | "danger" | "warn";

export interface StatProps {
  label: string;
  /** already formatted, e.g. `rupees(paise)`; tone colours it only for money states */
  figure: ReactNode;
  /** small unit beside the figure ("din", "bills") */
  unit?: string;
  /** one quiet line under it, from the API (a comparison, a date) */
  note?: ReactNode;
  tone?: StatTone;
  size?: "md" | "lg";
  className?: string;
}

/** A figure and its label. No icon, no trend arrow. Siblings sit in `<Stats>`. */
export function Stat({ label, figure, unit, note, tone = "neutral", size = "md", className }: StatProps) {
  return (
    <div className={cx("stat", className)} data-tone={tone} data-size={size}>
      <p className="stat-label">{label}</p>
      <p className="stat-figure figure">
        {figure}
        {unit ? <span className="stat-unit">{unit}</span> : null}
      </p>
      {note ? <p className="stat-note">{note}</p> : null}
    </div>
  );
}

/** Responsive row of stats separated by hairlines, never boxed. */
export function Stats({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("stats", className)}>{children}</div>;
}
