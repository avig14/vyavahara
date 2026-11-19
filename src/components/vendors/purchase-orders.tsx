import { Badge, EmptyState, ErrorState, SkeletonRows, Table, type BadgeTone } from "@/components/ui";
import { num } from "@/lib/format";
import { instantLabel } from "@/lib/ui/stock-dates";
import type { PurchaseOrder, Vendor } from "./types";

const PO_STATUS: Record<PurchaseOrder["status"], { label: string; tone: BadgeTone }> = {
  drafted: { label: "Draft", tone: "info" },
  sent: { label: "Bheja gaya", tone: "neutral" },
  received: { label: "Maal aa gaya", tone: "success" },
};

export interface PurchaseOrdersProps {
  orders: readonly PurchaseOrder[] | undefined;
  vendors: readonly Vendor[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  single?: boolean;
  heading?: string;
}

/** Read-only list of orders. Making or sending one is not done on this screen. */
export function PurchaseOrders({ orders, vendors, loading, error, onRetry, single, heading = "Draft orders" }: PurchaseOrdersProps) {
  const vname = new Map((vendors ?? []).map((v) => [v.id, v.name]));
  const id = `sup-po-${single ? "one" : "all"}`;
  let body;
  if (error && !orders) body = <ErrorState title="Orders load nahi hue" error={error} onRetry={onRetry} retrying={loading} />;
  else if (!orders) body = <SkeletonRows rows={3} cols={single ? 3 : 4} />;
  else if (orders.length === 0) body = <EmptyState title="Koi order draft nahi" description="Saathi se bolo kis supplier se kya mangwana hai. Draft banne par yahan dikhega." />;
  else {
    const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    body = (
      <Table caption={`${heading}, newest first`} dense>
        <thead>
          <tr>
            {single ? null : <th scope="col">Supplier</th>}
            <th scope="col">Items</th>
            <th scope="col">Status</th>
            <th scope="col">Banaya</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((o) => (
            <tr key={o.id}>
              {single ? null : (
                <td data-label="Supplier" data-primary="">
                  {vname.get(o.vendorId) ?? o.vendorId}
                </td>
              )}
              <td data-label="Items" data-primary={single ? "" : undefined}>
                <ul className="sup-lines">
                  {o.items.map((it) => (
                    <li key={it.productId}>
                      {it.name}, {num(it.qty, 1)} {it.unit}
                    </li>
                  ))}
                </ul>
              </td>
              <td data-label="Status">
                <Badge tone={PO_STATUS[o.status].tone}>{PO_STATUS[o.status].label}</Badge>
              </td>
              <td data-label="Banaya">{instantLabel(o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  }
  return (
    <section className="sup-sec" aria-labelledby={id}>
      <h2 id={id} className="stk-h">
        {heading}
      </h2>
      {body}
    </section>
  );
}
