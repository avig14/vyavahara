"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { LangToggle, useT } from "@/lib/ui/lang";

/** The logo, then the name and the Devanagari beside it. */
export function Wordmark({ size = 36 }: { size?: number }) {
  return (
    <Link href="/" className="lp-mark">
      <LogoMark size={size} />
      <span>
        Vyavahāra <span className="deva">व्यवहार</span>
      </span>
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
