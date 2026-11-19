import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

export type BadgeTone = "neutral" | "info" | "success" | "warn" | "danger";

export interface BadgeProps {
  /** the word carries the meaning ("Overdue", "Paid"); colour only backs it up */
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span className={cx("badge", className)} data-tone={tone}>
      {children}
    </span>
  );
}
