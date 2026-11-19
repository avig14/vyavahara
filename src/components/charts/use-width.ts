"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Width of the element in CSS px, kept current by a ResizeObserver. `fallback` is used until the first measure. */
export function useWidth<T extends HTMLElement>(fallback = 480): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(Math.max(1, Math.round(el.getBoundingClientRect().width)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
