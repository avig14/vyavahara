import { Badge, EmptyState, ErrorState, SkeletonRows, Table } from "@/components/ui";
import { pct, rupeesExact } from "@/lib/format";
import { instantLabel } from "@/lib/ui/stock-dates";
import type { PriceChange, Vendor } from "./types";

export interface PriceChangesProps {
  changes: readonly PriceChange[] | undefined;
  vendors: readonly Vendor[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  nameOf: (productId: string) => string;
  /** the rows are one supplier's: drop the supplier column */
  single?: boolean;
  heading?: string;
}

/** Old rate against new rate, straight from the vendor-product costs. Biggest move first (the API sorts). */
export function PriceChanges({ changes, vendors, loading, error, onRetry, nameOf, single, heading = "Rate badle" }: PriceChangesProps) {
  const vname = new Map((vendors ?? []).map((v) => [v.id, v.name]));
  const id = `sup-price-${single ? "one" : "all"}`;
  let body;
  if (error && !changes) body = <ErrorState title="Rate badlav load nahi hue" error={error} onRetry={onRetry} retrying={loading} />;
  else if (!changes) body = <SkeletonRows rows={3} cols={single ? 4 : 5} />;
  else if (changes.length === 0) body = <EmptyState title="Kisi supplier ka rate nahi badla" description="Naya bill aane par agar rate alag hua to yahan dikhega." />;
  else
    body = (
      <Table caption={`${heading}: purana aur naya rate`} dense>
        <thead>
          <tr>
            {single ? null : <th scope="col">Supplier</th>}
            <th scope="col">Product</th>
            <th scope="col" className="num">
              Pehle
            </th>
            <th scope="col" className="num">
              Ab
            </th>
            <th scope="col" className="num">
              Badlav
            </th>
            <th scope="col">Kab</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={`${c.vendorId}:${c.productId}`}>
              {single ? null : (
                <td data-label="Supplier" data-primary="">
                  {vname.get(c.vendorId) ?? c.vendorId}
                </td>
              )}
              <td data-label="Product" data-primary={single ? "" : undefined}>
                {nameOf(c.productId)}
              </td>
              <td className="num" data-label="Pehle">
                {rupeesExact(c.prevCostPaise)}
              </td>
              <td className="num" data-label="Ab">
                {rupeesExact(c.lastCostPaise)}
              </td>
              <td className="num" data-label="Badlav">
                <Badge tone={c.changePct > 0 ? "warn" : "success"}>{c.changePct > 0 ? "Mehnga" : "Sasta"}</Badge> {pct(c.changePct, 1)}
              </td>
              <td data-label="Kab">{instantLabel(c.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  return (
    <section className="sup-sec" aria-labelledby={id}>
      <h2 id={id} className="stk-h">
        {heading}
      </h2>
      {body}
    </section>
  );
}
