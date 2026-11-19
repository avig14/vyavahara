"use client";

import { useMemo, useState } from "react";
import { Button, EmptyState, PageHeader, SkeletonBlock } from "@/components/ui";
import { useApi } from "@/lib/ui/api";
import { useQueryParams, useQueryState, useQueryString } from "@/lib/ui/url-state";
import { useSearchText } from "@/lib/ui/use-search-text";
import { LostSales, ReorderList } from "./stock-aside";
import { StockDetail } from "./stock-detail";
import { StockFilters, type SortDir } from "./stock-filters";
import { StockTable } from "./stock-table";
import { isStatus, STATUS_ORDER } from "./status";
import type { InventoryPayload, StockStatus } from "./types";

const STATUS_VALUES = ["all", ...STATUS_ORDER] as const;

export function StockScreen() {
  const { data, error, loading, refetch } = useApi<InventoryPayload>("/api/dashboard/inventory");
  const [text, setText] = useSearchText("q");
  const [status, setStatus] = useQueryState<"all" | StockStatus>("status", { defaultValue: "all", allowed: STATUS_VALUES });
  const [sort, setSort] = useQueryState<SortDir>("sort", { defaultValue: "asc", allowed: ["asc", "desc"] });
  const [product, setProduct] = useQueryString("product");
  const { patch } = useQueryParams();
  const [picked, setPicked] = useState(false);
  const pick = (id: string) => {
    setPicked(true);
    setProduct(id);
  };

  const needle = text.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!data) return undefined;
    const list = data.forecasts.filter((f) => (status === "all" || f.status === status) && (!needle || `${f.name} ${f.category}`.toLowerCase().includes(needle)));
    return list.sort((a, b) => (sort === "asc" ? a.coverDays - b.coverDays : b.coverDays - a.coverDays) || a.name.localeCompare(b.name));
  }, [data, status, needle, sort]);

  const filtered = status !== "all" || needle !== "";
  const clear = () => patch({ q: null, status: null });
  const selected = data && product ? data.forecasts.find((f) => f.productId === product) : undefined;
  const missing = Boolean(data && product && !selected);

  return (
    <>
      <PageHeader
        title="Stock"
        hindi="स्टॉक"
        description={data ? `${data.forecasts.length} products. Jo pehle khatam hone wala hai woh upar.` : "Kaun sa maal kitne din chalega."}
      />
      <StockFilters
        text={text}
        onText={setText}
        status={isStatus(status) ? status : "all"}
        onStatus={(s) => setStatus(s)}
        counts={data?.counts}
        total={data?.forecasts.length}
        sort={sort}
        onSort={setSort}
      />
      <div className="stk-layout" data-detail={product ? "" : undefined}>
        <div className="stk-main">
          <StockTable
            rows={rows}
            loading={loading}
            error={error}
            onRetry={refetch}
            selected={product || null}
            onSelect={pick}
            sort={sort}
            onSort={setSort}
            filtered={filtered}
            onClear={clear}
          />
        </div>
        <aside className="stk-aside" aria-label={selected ? `Detail for ${selected.name}` : "Orders and lost sales"}>
          {selected && data ? (
            <StockDetail item={selected} data={data} onClose={() => setProduct(null)} takeFocus={picked} />
          ) : missing ? (
            <EmptyState
              title="Yeh product list mein nahi mila"
              description="Link purana ho sakta hai ya product hat gaya."
              action={<Button onClick={() => setProduct(null)}>Band karo</Button>}
            />
          ) : product && !data && !error ? (
            <SkeletonBlock height="22rem" />
          ) : (
            <>
              <ReorderList data={data} loading={loading} failed={Boolean(error) && !data} onSelect={pick} />
              <LostSales data={data} loading={loading} failed={Boolean(error) && !data} />
            </>
          )}
        </aside>
      </div>
    </>
  );
}
