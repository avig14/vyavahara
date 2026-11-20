import { Badge } from "@/components/ui";
import { useL } from "@/lib/ui/lang";
import { num } from "@/lib/format";
import { dayKeyLabel } from "@/lib/ui/stock-dates";
import type { Payable } from "./types";

/** Due date with a word that says how it stands. Overdue is the only red. */
export function DueBadge({
  bill,
  flagged,
}: {
  bill: Payable;
  flagged: boolean;
}) {
  const l = useL();
  const d = bill.dueInDays;
  const late = d < 0;
  const word = late
    ? l(
        `${num(-d)} ${-d === 1 ? "day" : "days"} late`,
        `${num(-d)} दिन लेट`,
        `${num(-d)} din late`,
      )
    : d === 0
      ? l("Due today", "आज देय", "Aaj due")
      : l(
          `in ${num(d)} ${d === 1 ? "day" : "days"}`,
          `${num(d)} दिन में`,
          `${num(d)} din mein`,
        );
  return (
    <span className="sup-due">
      <span>{dayKeyLabel(bill.dueDate)}</span>
      <Badge tone={late ? "danger" : flagged ? "warn" : "neutral"}>
        {word}
      </Badge>
    </span>
  );
}
