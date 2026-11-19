"use client";

import { useEffect, useState } from "react";
import { useQueryString } from "./url-state";

/**
 * A search box whose text lives in the URL (`?q=`). The box answers every keystroke at once;
 * the URL follows 250ms later so `router.replace` never fights the caret. A change made
 * elsewhere (back button, "clear filters") flows back into the box; our own echo does not.
 */
export function useSearchText(key = "q") {
  const [inUrl, setInUrl] = useQueryString(key);
  const [text, setText] = useState(inUrl);
  const [seen, setSeen] = useState(inUrl);
  const [pushed, setPushed] = useState(inUrl);

  if (inUrl !== seen) {
    setSeen(inUrl);
    if (inUrl !== pushed) {
      setText(inUrl);
      setPushed(inUrl);
    }
  }

  useEffect(() => {
    if (text === pushed) return;
    const t = window.setTimeout(() => {
      setPushed(text);
      setInUrl(text || null);
    }, 250);
    return () => window.clearTimeout(t);
  }, [text, pushed, setInUrl]);

  return [text, setText] as const;
}
