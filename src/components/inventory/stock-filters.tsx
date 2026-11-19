"use client";

import { Field, Input, Select } from "@/components/ui";
import { num } from "@/lib/format";
import { STATUS_META, STATUS_ORDER } from "./status";
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
export function StockFilters({ text, onText, status, onStatus, counts, total, sort, onSort }: StockFiltersProps) {
  return (
    <div className="stk-bar">
      <Field label="Search product" className="stk-search">
        <Input type="search" value={text} onChange={(e) => onText(e.target.value)} placeholder="Maggi, doodh, atta" autoComplete="off" />
      </Field>
      <fieldset className="stk-filter">
        <legend>Show</legend>
        <div className="stk-opts">
          <button type="button" className="stk-opt" aria-pressed={status === "all"} onClick={() => onStatus("all")}>
            Sab{total !== undefined ? <span className="num">{num(total)}</span> : null}
          </button>
          {STATUS_ORDER.map((s) => (
            <button key={s} type="button" className="stk-opt" aria-pressed={status === s} onClick={() => onStatus(s)}>
              {STATUS_META[s].label}
              {counts ? <span className="num">{num(counts[s] ?? 0)}</span> : null}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Sort by days of cover" className="stk-sortsel">
        <Select
          value={sort}
          onChange={(e) => onSort(e.target.value === "desc" ? "desc" : "asc")}
          options={[
            { value: "asc", label: "Lowest cover first" },
            { value: "desc", label: "Highest cover first" },
          ]}
        />
      </Field>
    </div>
  );
}
