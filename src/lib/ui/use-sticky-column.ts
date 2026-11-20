"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a side column in view beside a longer one. A short column sticks under the top bar; a column taller than the
 * screen scrolls until its bottom reaches the bottom of the screen, then stays put while the long column carries on.
 * Only used when the two columns sit side by side (the stylesheet turns `position: sticky` off on phones).
 */
export function useStickyColumn<T extends HTMLElement>(topOffset = 80, gap = 24) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const fit = window.innerHeight - el.offsetHeight - gap;
      el.style.top = `${Math.min(topOffset, fit)}px`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [topOffset, gap]);
  return ref;
}
