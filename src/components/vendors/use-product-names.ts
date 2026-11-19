"use client";

import { useMemo } from "react";
import { useApi } from "@/lib/ui/api";
import type { StockNames } from "./types";

/**
 * The vendor route names no products, only ids. The stock route does, so borrow its names.
 * Never blocks: until it answers (or if it fails) callers fall back to the raw id.
 */
export function useProductNames(): (productId: string) => string {
  const { data } = useApi<StockNames>("/api/dashboard/inventory");
  const map = useMemo(() => new Map((data?.forecasts ?? []).map((f) => [f.productId, f.name])), [data]);
  return (id) => map.get(id) ?? id;
}
