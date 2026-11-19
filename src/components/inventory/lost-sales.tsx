import { EmptyState, Table } from "@/components/ui";
import { rupees, num } from "@/lib/format";
import { instantLabel } from "@/lib/ui/stock-dates";
import type { LostRow } from "./types";

export interface LostTableProps {
  rows: readonly LostRow[];
  /** productId to name; when given the table adds a Product column */
  names?: ReadonlyMap<string, string>;
  caption: string;
}

/** Newest first: what the customer asked for, how many, what the sale was worth. */
export function LostTable({ rows, names, caption }: LostTableProps) {
  const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Table caption={caption} dense>
      <thead>
        <tr>
          <th scope="col">Date</th>
          {names ? <th scope="col">Product</th> : null}
          <th scope="col">Customer ne kaha</th>
          <th scope="col" className="num">
            Qty
          </th>
          <th scope="col" className="num">
            Value
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.id}>
            <td data-label="Date" data-primary="">
              {instantLabel(r.createdAt)}
            </td>
            {names ? <td data-label="Product">{names.get(r.productId) ?? r.productId}</td> : null}
            <td data-label="Customer ne kaha">{r.rawText ?? "Likha nahi"}</td>
            <td className="num" data-label="Qty">
              {num(r.qty, 1)}
            </td>
            <td className="num" data-label="Value">
              {rupees(r.estValuePaise)}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function LostEmpty() {
  return <EmptyState title="Abhi koi lost sale nahi" description="Jab customer koi cheez maange aur stock mein na ho, woh yahan likhi jaati hai." />;
}
