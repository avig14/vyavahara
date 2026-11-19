"use client";

import { Badge, Button, ChevronDownIcon, DataTable, EmptyState, type Column } from "@/components/ui";
import { num } from "@/lib/format";
import { coverLabel, STATUS_META } from "./status";
import type { ItemForecast } from "./types";
import type { SortDir } from "./stock-filters";

export interface StockTableProps {
  rows: readonly ItemForecast[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  selected: string | null;
  onSelect: (productId: string) => void;
  sort: SortDir;
  onSort: (v: SortDir) => void;
  /** a filter or search is active: an empty list then means "no match", not "no stock" */
  filtered: boolean;
  onClear: () => void;
}

export function StockTable({ rows, loading, error, onRetry, selected, onSelect, sort, onSort, filtered, onClear }: StockTableProps) {
  const next: SortDir = sort === "asc" ? "desc" : "asc";
  const columns: Column<ItemForecast>[] = [
    {
      key: "name",
      header: "Product",
      primary: true,
      cell: (r) => (
        <>
          {r.name}
          <span className="stk-sub">{r.category}</span>
        </>
      ),
    },
    { key: "stock", header: "On hand", num: true, cell: (r) => num(r.stock, 1) },
    {
      key: "cover",
      header: (
        <button
          type="button"
          className="stk-sortbtn"
          data-dir={sort}
          aria-label={`Days of cover, ${sort === "asc" ? "lowest first" : "highest first"}. Press for ${next === "asc" ? "lowest first" : "highest first"}.`}
          onClick={() => onSort(next)}
        >
          Days of cover
          <ChevronDownIcon size={14} />
        </button>
      ),
      label: "Days of cover",
      num: true,
      cell: (r) => coverLabel(r.coverDays),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge>,
    },
  ];

  return (
    <div className="stk-table">
      <DataTable
        caption={`Stock, sorted by days of cover ${sort === "asc" ? "lowest first" : "highest first"}`}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.productId}
        loading={loading}
        error={error}
        onRetry={onRetry}
        selectedKey={selected}
        onSelect={onSelect}
        skeletonRows={9}
        empty={
          filtered ? (
            <EmptyState
              title="Kuch nahi mila"
              description="Is search ya status mein koi product nahi hai. Filter hata kar dekho."
              action={
                <Button onClick={onClear}>Filter hatao</Button>
              }
            />
          ) : (
            <EmptyState title="Abhi koi product nahi" description="Stock list khaali hai. Product jodne ke baad yahan dikhega." />
          )
        }
      />
    </div>
  );
}
