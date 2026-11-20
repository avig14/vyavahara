import { useL, type L } from "@/lib/ui/lang";
import {
  Badge,
  EmptyState,
  ErrorState,
  SkeletonRows,
  Table,
  type BadgeTone,
} from "@/components/ui";
import { num } from "@/lib/format";
import { instantLabel } from "@/lib/ui/stock-dates";
import type { PurchaseOrder, Vendor } from "./types";

const poStatus = (
  l: L,
): Record<PurchaseOrder["status"], { label: string; tone: BadgeTone }> => ({
  drafted: { label: l("Draft", "ड्राफ़्ट", "Draft"), tone: "info" },
  sent: { label: l("Sent", "भेजा गया", "Bheja gaya"), tone: "neutral" },
  received: {
    label: l("Goods received", "माल आ गया", "Maal aa gaya"),
    tone: "success",
  },
});

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
export function PurchaseOrders({
  orders,
  vendors,
  loading,
  error,
  onRetry,
  single,
  heading,
}: PurchaseOrdersProps) {
  const l = useL();
  heading ??= l("Draft orders", "ड्राफ़्ट ऑर्डर", "Draft orders");
  const vname = new Map((vendors ?? []).map((v) => [v.id, v.name]));
  const id = `sup-po-${single ? "one" : "all"}`;
  let body;
  if (error && !orders)
    body = (
      <ErrorState
        title={l(
          "Could not load orders",
          "ऑर्डर नहीं खुल पाए",
          "Orders load nahi hue",
        )}
        error={error}
        onRetry={onRetry}
        retrying={loading}
      />
    );
  else if (!orders) body = <SkeletonRows rows={3} cols={single ? 3 : 4} />;
  else if (orders.length === 0)
    body = (
      <EmptyState
        title={l(
          "No draft orders",
          "कोई ड्राफ़्ट ऑर्डर नहीं",
          "Koi order draft nahi",
        )}
        description={l(
          "Tell Saathi what to order from which supplier. The draft will show here.",
          "साथी को बताएँ किस सप्लायर से क्या मँगवाना है। ड्राफ़्ट बनने पर यहाँ दिखेगा।",
          "Saathi se bolo kis supplier se kya mangwana hai. Draft banne par yahan dikhega.",
        )}
      />
    );
  else {
    const sorted = [...orders].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    body = (
      <Table
        caption={`${heading}, ${l("newest first", "नया ऊपर", "naya upar")}`}
        dense
      >
        <thead>
          <tr>
            {single ? null : (
              <th scope="col">{l("Supplier", "सप्लायर", "Supplier")}</th>
            )}
            <th scope="col">{l("Items", "सामान", "Items")}</th>
            <th scope="col">{l("Status", "स्थिति", "Status")}</th>
            <th scope="col">{l("Created", "बनाया", "Banaya")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((o) => (
            <tr key={o.id}>
              {single ? null : (
                <td
                  data-label={l("Supplier", "सप्लायर", "Supplier")}
                  data-primary=""
                >
                  {vname.get(o.vendorId) ?? o.vendorId}
                </td>
              )}
              <td
                data-label={l("Items", "सामान", "Items")}
                data-primary={single ? "" : undefined}
              >
                <ul className="sup-lines">
                  {o.items.map((it) => (
                    <li key={it.productId}>
                      {it.name}, {num(it.qty, 1)} {it.unit}
                    </li>
                  ))}
                </ul>
              </td>
              <td data-label={l("Status", "स्थिति", "Status")}>
                <Badge tone={poStatus(l)[o.status].tone}>
                  {poStatus(l)[o.status].label}
                </Badge>
              </td>
              <td data-label={l("Created", "बनाया", "Banaya")}>
                {instantLabel(o.createdAt)}
              </td>
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
