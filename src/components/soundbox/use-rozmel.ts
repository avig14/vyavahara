"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJson, toApiError, type ApiError } from "@/lib/ui/api";

export interface RozmelItem {
  name: string;
  qty: number;
  unitPricePaise: number;
  confidence: string;
}

export interface RozmelRow {
  id: string;
  at: string;
  /** refunds are already negative */
  amountPaise: number;
  kind: "sale" | "refund";
  method: string;
  source: string;
  utr: string | null;
  payer: string | null;
  items: RozmelItem[];
  runningTotalPaise: number;
}

export interface RozmelResponse {
  day: string;
  count: number;
  totalPaise: number;
  rows: RozmelRow[];
}

export const POLL_MS = 10_000;

export interface RozmelState {
  data: RozmelResponse | undefined;
  /** error of the latest attempt; cleared by the next success */
  error: ApiError | undefined;
  /** waiting for the very first answer */
  loading: boolean;
  /** a request is running right now */
  fetching: boolean;
  /** when the last successful answer arrived */
  updatedAt: Date | undefined;
  refresh: () => void;
}

/** GET /api/dashboard/rozmel now, then every 10 s while the tab is visible. A hidden tab makes no requests and refreshes the moment it is shown again. */
export function useRozmel(): RozmelState {
  const [data, setData] = useState<RozmelResponse | undefined>();
  const [error, setError] = useState<ApiError | undefined>();
  const [updatedAt, setUpdatedAt] = useState<Date | undefined>();
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(true);
  const run = useRef<() => void>(() => {});

  useEffect(() => {
    let live = true;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      setFetching(true);
      try {
        const d = await getJson<RozmelResponse>("/api/dashboard/rozmel");
        if (!live) return;
        setData(d);
        setError(undefined);
        setUpdatedAt(new Date());
      } catch (e) {
        if (live) setError(toApiError(e));
      } finally {
        busy = false;
        if (live) {
          setFetching(false);
          setLoading(false);
        }
      }
    };
    run.current = () => void load();
    const visible = () => document.visibilityState === "visible";
    void load();
    const id = window.setInterval(() => {
      if (visible()) void load();
    }, POLL_MS);
    const onVis = () => {
      if (visible()) void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      live = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const refresh = useCallback(() => run.current(), []);
  return { data, error, loading, fetching, updatedAt, refresh };
}
