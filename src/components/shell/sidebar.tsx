"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useQueryParams } from "@/lib/ui/url-state";
import { LangToggle } from "@/lib/ui/lang";
import { NAV_ITEMS, isCurrent } from "./nav";

const KEEP = ["period", "from", "to"] as const;

export function Wordmark({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="wordmark" aria-label="Vyavahāra, home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="wordmark-logo"
        src="/brand/vyavahara-logo.svg"
        alt=""
        aria-hidden="true"
        width={40}
        height={40}
      />
      <span className="wordmark-latin">Vyavahāra</span>
      <span className="wordmark-deva deva" lang="hi">
        व्यवहार
      </span>
    </Link>
  );
}

function NavLinks({
  search,
  onNavigate,
}: {
  search: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <ul className="nav-list">
      {NAV_ITEMS.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={`${item.href}${search}`}
              className="nav-link"
              aria-current={current ? "page" : undefined}
              onClick={onNavigate}
            >
              <span className="nav-label">
                <span className="nav-name">{item.label}</span>
              </span>
              <span className="nav-hi deva" lang="hi">
                {item.hindi}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Carries the chosen period from page to page, so a week stays a week. */
function NavWithPeriod({ onNavigate }: { onNavigate?: () => void }) {
  const { get } = useQueryParams();
  const next = new URLSearchParams();
  for (const k of KEEP) {
    const v = get(k);
    if (v) next.set(k, v);
  }
  const qs = next.toString();
  return <NavLinks search={qs ? `?${qs}` : ""} onNavigate={onNavigate} />;
}

export interface SidebarNavProps {
  onNavigate?: () => void;
}

/** The nav block: wordmark, eight destinations, Soundbox link. Used in the sidebar and the phone drawer. */
export function SidebarNav({ onNavigate }: SidebarNavProps) {
  return (
    <>
      <div className="side-head">
        <Wordmark />
      </div>
      <nav aria-label="Main" className="side-nav">
        <Suspense fallback={<NavLinks search="" onNavigate={onNavigate} />}>
          <NavWithPeriod onNavigate={onNavigate} />
        </Suspense>
      </nav>
      <div className="side-foot">
        <div className="side-lang">
          <LangToggle onDark />
        </div>
        <Link
          href="/soundbox"
          prefetch={false}
          className="nav-link"
          onClick={onNavigate}
        >
          <span className="nav-label">
            <span className="nav-name">Soundbox</span>
          </span>
          <span className="nav-hi deva" lang="hi">
            साउंडबॉक्स
          </span>
        </Link>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="sidebar">
      <SidebarNav />
    </aside>
  );
}
