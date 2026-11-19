"use client";

import { useMemo, useState } from "react";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { rupees } from "@/lib/format";
import { useApi } from "@/lib/ui/api";
import { useQueryString } from "@/lib/ui/url-state";
import { buildSuppliers } from "./model";
import { PriceChanges } from "./price-changes";
import { PurchaseOrders } from "./purchase-orders";
import { SupplierTable } from "./supplier-table";
import { useProductNames } from "./use-product-names";
import { VendorDetail } from "./vendor-detail";
import type { VendorsPayload } from "./types";

export function VendorsScreen() {
  const { data, error, loading, refetch } = useApi<VendorsPayload>("/api/dashboard/vendors");
  const nameOf = useProductNames();
  const [vendor, setVendor] = useQueryString("vendor");
  const [picked, setPicked] = useState(false);
  const rows = useMemo(() => (data ? buildSuppliers(data) : undefined), [data]);
  const owed = rows ? rows.reduce((s, r) => s + r.outstandingPaise, 0) : 0;
  const selected = rows && vendor ? rows.find((r) => r.vendor.id === vendor) : undefined;
  const missing = Boolean(rows && vendor && !selected);
  const failed = error && !data ? error : undefined;

  return (
    <>
      <PageHeader
        title="Suppliers"
        hindi="सप्लायर"
        description={rows ? (owed > 0 ? `Kul ${rupees(owed)} baaki hai. Jiska bill pehle due hai woh upar.` : "Kisi supplier ka kuch baaki nahi.") : "Kisko kitna dena hai, aur kiska rate badla."}
      />
      <SupplierTable rows={rows} loading={loading} error={failed} onRetry={refetch} selected={vendor || null} onSelect={(id) => {
          setPicked(true);
          setVendor(id);
        }} nameOf={nameOf} />

      {selected && data ? <VendorDetail row={selected} data={data} nameOf={nameOf} onClose={() => setVendor(null)} takeFocus={picked} /> : null}
      {missing ? (
        <div className="sup-detail">
          <EmptyState title="Yeh supplier list mein nahi mila" description="Link purana ho sakta hai." action={<Button onClick={() => setVendor(null)}>Band karo</Button>} />
        </div>
      ) : null}

      <div className="sup-regions">
        <PriceChanges changes={data?.priceChanges} vendors={data?.vendors} loading={loading} error={failed} onRetry={refetch} nameOf={nameOf} />
        <PurchaseOrders orders={data?.purchaseOrders} vendors={data?.vendors} loading={loading} error={failed} onRetry={refetch} />
      </div>
    </>
  );
}
