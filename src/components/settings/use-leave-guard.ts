"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * While `active`, warn before the page is lost with unsaved edits:
 * - closing the tab, reloading or typing another address: the browser's own `beforeunload` prompt
 *   (handler calls preventDefault, as MDN documents; the text is the browser's and cannot be changed);
 * - clicking any in-app link (sidebar, menu drawer): intercepted in the capture phase so the caller can show its own dialog.
 * The browser Back button is covered by `beforeunload` only when it leaves the site.
 */
export function useLeaveGuard(active: boolean) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = true;
    };
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      if (!(e.target instanceof Element)) return;
      const a = e.target.closest("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download"))
        return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBefore);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  const stay = useCallback(() => setTarget(null), []);
  const leave = useCallback(() => {
    const t = target;
    setTarget(null);
    if (t) router.push(t);
  }, [target, router]);

  return { leaveOpen: target !== null, leave, stay };
}
