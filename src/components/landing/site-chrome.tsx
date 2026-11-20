"use client";

import Link from "next/link";
import { LangToggle, useT } from "@/lib/ui/lang";

/** Text wordmark: the name and the Devanagari beside it. No logo. */
export function Wordmark() {
  return (
    <Link href="/" className="lp-mark">
      Vyavahāra <span className="deva">व्यवहार</span>
    </Link>
  );
}

/** Public-page nav: wordmark at one edge, the one other real destination at the other. */
export function SiteNav() {
  const t = useT();
  return (
    <header className="lp-nav">
      <div className="container lp-nav-in">
        <Wordmark />
        <div className="lp-nav-end">
          <LangToggle />
          <Link href="/privacy" className="lp-link">
            {t("nav.privacy")}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="lp-foot">
      <div className="container lp-foot-in">
        <Wordmark />
        <p>{t("foot.demo")}</p>
        <Link href="/privacy" className="lp-link">
          {t("nav.privacy")}
        </Link>
      </div>
    </footer>
  );
}
