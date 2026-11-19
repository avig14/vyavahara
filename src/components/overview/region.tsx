"use client";

import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/error-state";
import type { ApiState } from "@/lib/ui/api";

export interface RegionProps<T> {
  state: ApiState<T>;
  /** shaped like the content that is coming */
  skeleton: ReactNode;
  /** what broke, in plain English */
  errorTitle: string;
  /** keep showing the last good data while a refetch runs (a manual refresh); a changed url still shows the skeleton */
  keepStale?: boolean;
  children: (data: T) => ReactNode;
}

/** Loading, error and full for one data region; the region's own empty state is the caller's. One region failing leaves the rest of the page alone. */
export function Region<T>({ state, skeleton, errorTitle, keepStale, children }: RegionProps<T>) {
  if (state.error) return <ErrorState title={errorTitle} error={state.error} onRetry={state.refetch} retrying={state.loading} />;
  if (!state.data || (state.loading && !keepStale)) return <>{skeleton}</>;
  return <>{children(state.data)}</>;
}
