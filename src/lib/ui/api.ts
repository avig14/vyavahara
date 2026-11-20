"use client";

import { useCallback, useEffect, useState } from "react";

/** Routes answer with the bare payload on success and `{ error: string }` on failure. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** status 0 means the request never reached the server */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError(0, e instanceof Error ? e.message : "Something went wrong");
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  if (status === 404) return "Not found";
  if (status >= 500) return "Server error. Try again in a moment.";
  return `Request failed (${status})`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection.");
  }
  const body = await readBody(res);
  if (!res.ok) throw new ApiError(res.status, errorMessage(body, res.status));
  return body as T;
}

function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const getJson = <T>(url: string) => request<T>(url);
export const postJson = <T>(url: string, body?: unknown) => send<T>("POST", url, body);
/** multipart upload: no content-type header, the browser adds the boundary */
export const postForm = <T>(url: string, form: FormData) => request<T>(url, { method: "POST", body: form });
export const putJson = <T>(url: string, body?: unknown) => send<T>("PUT", url, body);
export const deleteJson = <T>(url: string) => send<T>("DELETE", url);

/** Identical GETs that overlap in time share one request (the shell and a page often ask for the same URL). */
const inflight = new Map<string, Promise<unknown>>();

function dedupedGet<T>(url: string, fresh: boolean): Promise<T> {
  const hit = fresh ? undefined : inflight.get(url);
  if (hit) return hit as Promise<T>;
  const p = request<T>(url).finally(() => {
    if (inflight.get(url) === p) inflight.delete(url);
  });
  inflight.set(url, p);
  return p;
}

export interface ApiState<T> {
  /** last good payload; stays while a new url or refetch is in flight */
  data: T | undefined;
  /** error of the current request only */
  error: ApiError | undefined;
  /** true from the moment `url` changes (or refetch runs) until it settles */
  loading: boolean;
  refetch: () => void;
}

interface Settled<T> {
  key: string;
  data?: T;
  error?: ApiError;
}

/** GET `url` (no-store). Pass `null` to wait. Show a skeleton when `!data && loading`, an ErrorState when `error`. */
export function useApi<T>(url: string | null): ApiState<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [lastData, setLastData] = useState<T | undefined>(undefined);
  const key = url === null ? null : `${nonce}|${url}`;

  useEffect(() => {
    if (url === null || key === null) return;
    let live = true;
    dedupedGet<T>(url, nonce > 0).then(
      (data) => {
        if (!live) return;
        setLastData(data);
        setSettled({ key, data });
      },
      (e: unknown) => {
        if (live) setSettled({ key, error: toApiError(e) });
      },
    );
    return () => {
      live = false;
    };
  }, [url, key, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  const done = settled !== null && settled.key === key;
  return {
    data: lastData,
    error: done ? settled.error : undefined,
    loading: key !== null && !done,
    refetch,
  };
}
