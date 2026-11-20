import {
  Badge,
  EmptyState,
  ErrorState,
  SkeletonRows,
  Table,
} from "@/components/ui";
import { useL } from "@/lib/ui/lang";
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
export function PriceChanges({
  changes,
  vendors,
  loading,
  error,
  onRetry,
  nameOf,
  single,
  heading,
}: PriceChangesProps) {
  const l = useL();
  heading ??= l("Rate changes", "रेट में बदलाव", "Rate badle");
  const vname = new Map((vendors ?? []).map((v) => [v.id, v.name]));
  const id = `sup-price-${single ? "one" : "all"}`;
  let body;
  if (error && !changes)
    body = (
      <ErrorState
        title={l(
          "Could not load rate changes",
          "रेट बदलाव नहीं खुल पाए",
          "Rate badlav load nahi hue",
        )}
        error={error}
        onRetry={onRetry}
        retrying={loading}
      />
    );
  else if (!changes) body = <SkeletonRows rows={3} cols={single ? 4 : 5} />;
  else if (changes.length === 0)
    body = (
      <EmptyState
        title={l(
          "No supplier changed a rate",
          "किसी सप्लायर ने रेट नहीं बदला",
          "Kisi supplier ka rate nahi badla",
        )}
        description={l(
          "If a new bill has a different rate, it will show here.",
          "नया बिल आने पर अगर रेट अलग हुआ तो यहाँ दिखेगा।",
          "Naya bill aane par agar rate alag hua to yahan dikhega.",
        )}
      />
    );
  else
    body = (
      <Table
        caption={`${heading}: ${l("old and new rate", "पुराना और नया रेट", "purana aur naya rate")}`}
        dense
      >
        <thead>
          <tr>
            {single ? null : (
              <th scope="col">{l("Supplier", "सप्लायर", "Supplier")}</th>
            )}
            <th scope="col">{l("Product", "प्रोडक्ट", "Product")}</th>
            <th scope="col" className="num">
              {l("Before", "पहले", "Pehle")}
            </th>
            <th scope="col" className="num">
              {l("Now", "अब", "Ab")}
            </th>
            <th scope="col" className="num">
              {l("Change", "बदलाव", "Badlav")}
            </th>
            <th scope="col">{l("When", "कब", "Kab")}</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={`${c.vendorId}:${c.productId}`}>
              {single ? null : (
                <td
                  data-label={l("Supplier", "सप्लायर", "Supplier")}
                  data-primary=""
                >
                  {vname.get(c.vendorId) ?? c.vendorId}
                </td>
              )}
              <td
                data-label={l("Product", "प्रोडक्ट", "Product")}
                data-primary={single ? "" : undefined}
              >
                {nameOf(c.productId)}
              </td>
              <td className="num" data-label={l("Before", "पहले", "Pehle")}>
                {rupeesExact(c.prevCostPaise)}
              </td>
              <td className="num" data-label={l("Now", "अब", "Ab")}>
                {rupeesExact(c.lastCostPaise)}
              </td>
              <td className="num" data-label={l("Change", "बदलाव", "Badlav")}>
                <Badge tone={c.changePct > 0 ? "warn" : "success"}>
                  {c.changePct > 0
                    ? l("Costlier", "महँगा", "Mehnga")
                    : l("Cheaper", "सस्ता", "Sasta")}
                </Badge>{" "}
                {pct(c.changePct, 1)}
              </td>
              <td data-label={l("When", "कब", "Kab")}>
                {instantLabel(c.updatedAt)}
              </td>
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
