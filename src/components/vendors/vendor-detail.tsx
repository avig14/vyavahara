"use client";

import { useEffect, useRef } from "react";
import { Badge, Button, EmptyState, Table } from "@/components/ui";
import { num, rupees } from "@/lib/format";
import { DueBadge } from "./due-badge";
import type { SupplierRow } from "./model";
import { PriceChanges } from "./price-changes";
import { PurchaseOrders } from "./purchase-orders";
import type { VendorsPayload } from "./types";

export interface VendorDetailProps {
  row: SupplierRow;
  data: VendorsPayload;
  nameOf: (productId: string) => string;
  onClose: () => void;
  takeFocus: boolean;
}

/** One supplier: terms, open bills, their rate changes, their orders. The API has no payment history or product list, so none is shown. */
export function VendorDetail({ row, data, nameOf, onClose, takeFocus }: VendorDetailProps) {
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (takeFocus) head.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.vendor.id]);
  const v = row.vendor;
  const changes = data.priceChanges.filter((c) => c.vendorId === v.id);
  const orders = data.purchaseOrders.filter((o) => o.vendorId === v.id);
  const switches = data.recommendations.filter((r) => r.type === "VENDOR_SWITCH" && (r.facts.from === v.name || r.facts.to === v.name));
  const flagged = new Set(data.recommendations.filter((r) => r.type === "PAYABLE_DUE").map((r) => r.id.slice(r.id.indexOf(":") + 1)));
  const noop = () => undefined;

  return (
    <section className="sup-detail" aria-labelledby="sup-detail-title">
      <div className="sup-detail-head">
        <div className="stk-title">
          <h2 id="sup-detail-title" className="stk-h" ref={head} tabIndex={-1}>
            {v.name}
          </h2>
          <div className="stk-title-meta">
            {v.phone ? (
              <a className="sup-tel" href={`tel:${v.phone.replace(/[^+\d]/g, "")}`}>
                {v.phone}
              </a>
            ) : null}
            <span>
              Credit {num(v.paymentTermsDays)} din, delivery {num(v.leadTimeDays)} din
            </span>
          </div>
        </div>
        <Button variant="quiet" onClick={onClose}>
          Band karo
        </Button>
      </div>

      <div className="sup-detail-cols">
        <section className="sup-sec" aria-labelledby="sup-bills">
          <h3 id="sup-bills" className="stk-h3">
            Khule bills
          </h3>
          {row.bills.length === 0 ? (
            <EmptyState title="Is supplier ka kuch baaki nahi" />
          ) : (
            <Table caption={`Open bills of ${v.name}`} dense>
              <thead>
                <tr>
                  <th scope="col">Bill</th>
                  <th scope="col">Due</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {row.bills.map((b) => (
                  <tr key={b.purchaseId}>
                    <td data-label="Bill" data-primary="">
                      {b.invoiceNo ?? b.purchaseId}
                    </td>
                    <td data-label="Due">
                      <DueBadge bill={b} flagged={flagged.has(b.purchaseId)} />
                    </td>
                    <td className="num" data-label="Amount">
                      {rupees(b.amountPaise)}
                    </td>
                    <td data-label="Status">
                      <Badge tone={b.status === "partial" ? "info" : "neutral"}>{b.status === "partial" ? "Kuch diya" : "Baaki"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td data-label="Bill">Kul baaki</td>
                  <td data-nolabel="" />
                  <td className="num" data-label="Amount">
                    {rupees(row.outstandingPaise)}
                  </td>
                  <td data-nolabel="" />
                </tr>
              </tfoot>
            </Table>
          )}
        </section>

        <div className="sup-regions sup-regions-in">
          <PriceChanges changes={changes} vendors={[v]} loading={false} error={undefined} onRetry={noop} nameOf={nameOf} single heading="Iske rate badle" />
          <PurchaseOrders orders={orders} vendors={[v]} loading={false} error={undefined} onRetry={noop} single heading="Iske orders" />
          {switches.length > 0 ? (
            <section className="sup-sec" aria-labelledby="sup-switch">
              <h3 id="sup-switch" className="stk-h3">
                Saste supplier ka suggestion
              </h3>
              <ul className="sup-lines">
                {switches.map((s) => (
                  <li key={s.id}>{s.title}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
