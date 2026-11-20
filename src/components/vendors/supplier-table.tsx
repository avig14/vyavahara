"use client";

import { DataTable, EmptyState, type Column } from "@/components/ui";
import { useL } from "@/lib/ui/lang";
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

export function SupplierTable({
  rows,
  loading,
  error,
  onRetry,
  selected,
  onSelect,
  nameOf,
}: SupplierTableProps) {
  const l = useL();
  const columns: Column<SupplierRow>[] = [
    {
      key: "name",
      header: l("Supplier", "सप्लायर", "Supplier"),
      primary: true,
      cell: (r) => (
        <>
          {r.vendor.name}
          {r.vendor.phone ? (
            <span className="stk-sub">{r.vendor.phone}</span>
          ) : null}
        </>
      ),
    },
    {
      key: "owed",
      header: l("Due", "बाक़ी", "Baaki"),
      num: true,
      cell: (r) =>
        r.outstandingPaise > 0
          ? rupees(r.outstandingPaise)
          : l("Nothing", "कुछ नहीं", "Kuch nahi"),
    },
    {
      key: "due",
      header: l("Next due", "अगला देय", "Next due"),
      cell: (r) =>
        r.next ? (
          <DueBadge bill={r.next} flagged={r.nextFlagged} />
        ) : (
          l("No bill", "कोई बिल नहीं", "Koi bill nahi")
        ),
    },
    {
      key: "rate",
      header: l("Last rate change", "आख़िरी रेट बदलाव", "Last rate change"),
      cell: (r) =>
        r.change ? (
          <span className="sup-cell">
            <span>{nameOf(r.change.productId)}</span>
            <span className="stk-sub">
              {rupeesExact(r.change.prevCostPaise)} {l("to", "से", "se")}{" "}
              {rupeesExact(r.change.lastCostPaise)}{" "}
              <span className={r.change.changePct > 0 ? "pct-up" : "pct-down"}>
                {pct(r.change.changePct, 1)}
              </span>
            </span>
          </span>
        ) : (
          l("No change", "कोई बदलाव नहीं", "Koi badlav nahi")
        ),
    },
    {
      key: "terms",
      header: l("Credit", "उधार की अवधि", "Credit"),
      num: true,
      cell: (r) =>
        `${num(r.vendor.paymentTermsDays)} ${l("days", "दिन", "din")}`,
    },
  ];

  return (
    <div className="sup-table">
      <DataTable
        caption={l(
          "Suppliers, soonest bill first",
          "सप्लायर, जिसका बिल पहले देय है वह ऊपर",
          "Suppliers, jiska bill pehle due hai woh upar",
        )}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.vendor.id}
        loading={loading}
        error={error}
        onRetry={onRetry}
        selectedKey={selected}
        onSelect={onSelect}
        skeletonRows={6}
        empty={
          <EmptyState
            title={l(
              "No suppliers yet",
              "अभी कोई सप्लायर नहीं",
              "Abhi koi supplier nahi",
            )}
            description={l(
              "Once suppliers are added, their dues and due dates will show here.",
              "सप्लायर जुड़ने पर उनका बाक़ी और देय तारीख़ यहाँ दिखेगी।",
              "Supplier jud jaayein to unka baaki aur due date yahan dikhega.",
            )}
          />
        }
      />
    </div>
  );
}
