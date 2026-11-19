import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { ChevronDownIcon } from "./icons";

export interface DisclosureProps {
  summary: ReactNode;
  /** right side of the summary row (a count, a total) */
  meta?: ReactNode;
  defaultOpen?: boolean;
  /** native `toggle` event, for state kept in the URL */
  onToggle?: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}

/** Native `<details>`: works without script, keyboard and screen reader for free. */
export function Disclosure({ summary, meta, defaultOpen, onToggle, className, children }: DisclosureProps) {
  return (
    <details className={cx("disc", className)} open={defaultOpen} onToggle={onToggle ? (e) => onToggle(e.currentTarget.open) : undefined}>
      <summary>
        <span>{summary}</span>
        {meta ? <span className="disc-meta">{meta}</span> : null}
        <ChevronDownIcon size={16} />
      </summary>
      <div className="disc-body">{children}</div>
    </details>
  );
}
