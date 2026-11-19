import Link from "next/link";

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
  return (
    <header className="lp-nav">
      <div className="container lp-nav-in">
        <Wordmark />
        <Link href="/privacy" className="lp-link">
          Privacy
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="lp-foot">
      <div className="container lp-foot-in">
        <Wordmark />
        <p>Demo build: one sample shop, no sign-in.</p>
        <Link href="/privacy" className="lp-link">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
