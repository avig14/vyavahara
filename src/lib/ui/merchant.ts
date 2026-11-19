"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useApi } from "./api";
import { usePeriod } from "./period";

export interface Merchant {
  name: string;
  ownerName: string;
}

const KEY = "vyavahara.merchant";

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const noop = () => () => {};

/**
 * Shop and owner name. Only `GET /api/dashboard/overview` carries them, so the answer is kept in
 * sessionStorage and the route is asked only when nothing is stored yet (with the same period query
 * the Overview page uses, so both share one request).
 */
export function useMerchant(): Merchant | null {
  const { apiQuery } = usePeriod();
  const cached = useSyncExternalStore(noop, read, () => null);
  const { data } = useApi<{ merchant: Merchant }>(cached ? null : `/api/dashboard/overview?${apiQuery}`);
  const fresh = data?.merchant;

  useEffect(() => {
    if (!fresh) return;
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(fresh));
    } catch {
      /* storage can be blocked */
    }
  }, [fresh]);

  return useMemo(() => {
    if (cached) {
      try {
        return JSON.parse(cached) as Merchant;
      } catch {
        /* fall through to fresh */
      }
    }
    return fresh ?? null;
  }, [cached, fresh]);
}
