"use client";

import { useCallback, useState } from "react";

const KEY = "vy-actions-v1";
const DEFER_MS = 24 * 3_600_000;

interface Stored {
  done: Record<string, number>;
  later: Record<string, number>;
}

function read(): Stored {
  if (typeof window === "undefined") return { done: {}, later: {} };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Stored | null;
    return v && v.done && v.later ? v : { done: {}, later: {} };
  } catch {
    return { done: {}, later: {} };
  }
}

/**
 * Which recommendations the owner marked done or put off, kept on this device.
 * "Done" hides it for a week, "later" for a day; after that it returns if it is still true.
 */
export function useActionState() {
  // Only mounted after the overview data has loaded in the browser, so reading storage here cannot mismatch server HTML.
  const [state, setState] = useState<Stored>(read);
  const [now] = useState(() => Date.now());
  const write = useCallback((next: Stored) => {
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);
  const hidden = (id: string) => (state.done[id] ?? 0) + 7 * DEFER_MS > now || (state.later[id] ?? 0) + DEFER_MS > now;
  return {
    hidden,
    markDone: (id: string) => write({ ...state, done: { ...state.done, [id]: Date.now() } }),
    later: (id: string) => write({ ...state, later: { ...state.later, [id]: Date.now() } }),
    undo: (id: string) => {
      const done = { ...state.done };
      const later = { ...state.later };
      delete done[id];
      delete later[id];
      write({ done, later });
    },
  };
}
