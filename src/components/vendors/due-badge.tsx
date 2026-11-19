import { Badge } from "@/components/ui";
import { num } from "@/lib/format";
import { dayKeyLabel } from "@/lib/ui/stock-dates";
import type { Payable } from "./types";

/** Due date with a word that says how it stands. Overdue is the only red. */
export function DueBadge({ bill, flagged }: { bill: Payable; flagged: boolean }) {
  const d = bill.dueInDays;
  const late = d < 0;
  const word = late ? `${num(-d)} din late` : d === 0 ? "Aaj due" : `${num(d)} din mein`;
  return (
    <span className="sup-due">
      <span>{dayKeyLabel(bill.dueDate)}</span>
      <Badge tone={late ? "danger" : flagged ? "warn" : "neutral"}>{word}</Badge>
    </span>
  );
}
