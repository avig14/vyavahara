"use client";

import { DataTable, EmptyState, type Column } from "@/components/ui";
import { num, pct, rupees, rupeesExact } from "@/lib/format";
import { DueBadge } from "./due-badge";
import type { SupplierRow } from "./model";

export interface SupplierTableProps {
  rows: readonly SupplierRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  selected: string | null;
  onSelect: (vendorId: string) => void;
  nameOf: (productId: string) => string;
}

export function SupplierTable({ rows, loading, error, onRetry, selected, onSelect, nameOf }: SupplierTableProps) {
  const columns: Column<SupplierRow>[] = [
    {
      key: "name",
      header: "Supplier",
      primary: true,
      cell: (r) => (
        <>
          {r.vendor.name}
          {r.vendor.phone ? <span className="stk-sub">{r.vendor.phone}</span> : null}
        </>
      ),
    },
    {
      key: "owed",
      header: "Baaki",
      num: true,
      cell: (r) => (r.outstandingPaise > 0 ? rupees(r.outstandingPaise) : "Kuch nahi"),
    },
    {
      key: "due",
      header: "Next due",
      cell: (r) => (r.next ? <DueBadge bill={r.next} flagged={r.nextFlagged} /> : "Koi bill nahi"),
    },
    {
      key: "rate",
      header: "Last rate change",
      cell: (r) =>
        r.change ? (
          <span className="sup-cell">
            <span>{nameOf(r.change.productId)}</span>
            <span className="stk-sub">
              {rupeesExact(r.change.prevCostPaise)} se {rupeesExact(r.change.lastCostPaise)}{" "}
              <span className={r.change.changePct > 0 ? "pct-up" : "pct-down"}>{pct(r.change.changePct, 1)}</span>
            </span>
          </span>
        ) : (
          "Koi badlav nahi"
        ),
    },
    { key: "terms", header: "Credit", num: true, cell: (r) => `${num(r.vendor.paymentTermsDays)} din` },
  ];

  return (
    <div className="sup-table">
    <DataTable
      caption="Suppliers, soonest bill first"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.vendor.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      selectedKey={selected}
      onSelect={onSelect}
      skeletonRows={6}
      empty={<EmptyState title="Abhi koi supplier nahi" description="Supplier jud jaayein to unka baaki aur due date yahan dikhega." />}
    />
    </div>
  );
}

