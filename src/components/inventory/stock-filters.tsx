"use client";

import { Field, Input, Select } from "@/components/ui";
import { num } from "@/lib/format";
import { statusMeta, STATUS_ORDER } from "./status";
import { useL } from "@/lib/ui/lang";
import type { StockStatus } from "./types";

export type SortDir = "asc" | "desc";

export interface StockFiltersProps {
  text: string;
  onText: (v: string) => void;
  status: StockStatus | "all";
  onStatus: (v: StockStatus | "all") => void;
  counts: Partial<Record<StockStatus, number>> | undefined;
  total: number | undefined;
  sort: SortDir;
  onSort: (v: SortDir) => void;
}

/** Search, status filter (with how many in each) and, on a phone where the table has no header row, the sort. */
export function StockFilters({
  text,
  onText,
  status,
  onStatus,
  counts,
  total,
  sort,
  onSort,
}: StockFiltersProps) {
  const l = useL();
  const meta = statusMeta(l);
  return (
    <div className="stk-bar">
      <Field
        label={l("Search product", "प्रोडक्ट खोजें", "Product dhundho")}
        className="stk-search"
      >
        <Input
          type="search"
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder={l(
            "Maggi, milk, atta",
            "मैगी, दूध, आटा",
            "Maggi, doodh, atta",
          )}
          autoComplete="off"
        />
      </Field>
      <fieldset className="stk-filter">
        <legend>{l("Show", "दिखाएँ", "Dikhao")}</legend>
        <div className="stk-opts">
          <button
            type="button"
            className="stk-opt"
            aria-pressed={status === "all"}
            onClick={() => onStatus("all")}
          >
            {l("All", "सब", "Sab")}
            {total !== undefined ? (
              <span className="num">{num(total)}</span>
            ) : null}
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className="stk-opt"
              aria-pressed={status === s}
              onClick={() => onStatus(s)}
            >
              {meta[s].label}
              {counts ? (
                <span className="num">{num(counts[s] ?? 0)}</span>
              ) : null}
            </button>
          ))}
        </div>
      </fieldset>
      <Field
        label={l(
          "Sort by days of cover",
          "बचे दिनों के हिसाब से क्रम",
          "Bache dinon ke hisaab se kram",
        )}
        className="stk-sortsel"
      >
        <Select
          value={sort}
          onChange={(e) => onSort(e.target.value === "desc" ? "desc" : "asc")}
          options={[
            {
              value: "asc",
              label: l(
                "Lowest cover first",
                "सबसे कम दिन वाले पहले",
                "Sabse kam din wale pehle",
              ),
            },
            {
              value: "desc",
              label: l(
                "Highest cover first",
                "सबसे ज़्यादा दिन वाले पहले",
                "Sabse zyada din wale pehle",
              ),
            },
          ]}
        />
      </Field>
    </div>
  );
}
