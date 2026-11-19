"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** `null` or `""` removes the key. */
export type QueryPatch = Record<string, string | null | undefined>;

/**
 * Read and patch the query string in one place; patches go through `router.replace` with `scroll: false`.
 * Must sit under a Suspense boundary (the dashboard layout already provides one).
 */
export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const patch = useCallback(
    (next: QueryPatch) => {
      // read the live URL so two patches in one tick do not overwrite each other
      const qs = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === undefined || v === "") qs.delete(k);
        else qs.set(k, v);
      }
      const s = qs.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return { params, get: (key: string) => params.get(key), patch };
}

export interface QueryStateOptions<T extends string> {
  defaultValue: T;
  /** values outside this list fall back to the default */
  allowed?: readonly T[];
}

/** One typed string key in the URL. Writing the default value removes the key, so URLs stay short. */
export function useQueryState<T extends string>(key: string, opts: QueryStateOptions<T>): readonly [T, (value: T | null) => void] {
  const { get, patch } = useQueryParams();
  const raw = get(key);
  const value = raw !== null && (!opts.allowed || (opts.allowed as readonly string[]).includes(raw)) ? (raw as T) : opts.defaultValue;
  const { defaultValue } = opts;
  const set = useCallback(
    (next: T | null) => patch({ [key]: next === null || next === defaultValue ? null : next }),
    [patch, key, defaultValue],
  );
  return [value, set] as const;
}

/** Free-text key (search box, selected row id). Empty string means absent. */
export function useQueryString(key: string): readonly [string, (value: string | null) => void] {
  const { get, patch } = useQueryParams();
  const set = useCallback((next: string | null) => patch({ [key]: next }), [patch, key]);
  return [get(key) ?? "", set] as const;
}
