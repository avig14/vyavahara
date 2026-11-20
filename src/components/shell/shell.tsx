"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { CloseIcon } from "@/components/ui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isCurrent } from "./nav";
import { useL } from "@/lib/ui/lang";
import { BrandIcon } from "@/components/ui/brand-icon";
import { ChatPanel } from "./chat-panel";
import { Sidebar, SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";

function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label="Menu"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-close">
        <IconButton label="Close menu" onClick={onClose}>
          <CloseIcon size={20} />
        </IconButton>
      </div>
      <SidebarNav onNavigate={onClose} />
    </dialog>
  );
}

const BOTTOM = [
  "/dashboard",
  "/dashboard/inventory",
  "/dashboard/khata",
  "/dashboard/vendors",
];

/** Phone navigation: the four daily destinations and the full menu, within thumb reach. */
function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => BOTTOM.includes(i.href));
  return (
    <nav className="bnav" aria-label="Main">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className="bnav-link"
          aria-current={isCurrent(pathname, i.href) ? "page" : undefined}
        >
          <span className="bnav-label">{i.label}</span>
          <span className="bnav-hi deva" lang="hi">
            {i.hindi}
          </span>
        </Link>
      ))}
      <button type="button" className="bnav-link" onClick={onMore}>
        <span className="bnav-label">More</span>
        <span className="bnav-hi deva" lang="hi">
          और
        </span>
      </button>
    </nav>
  );
}

/** Client frame of the dashboard: sidebar, top bar, phone menu drawer, Saathi panel. Page content is `children`. */
export function Shell({ children }: { children: ReactNode }) {
  const l = useL();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  useEffect(() => {
    const open = () => setChatOpen(true);
    window.addEventListener("vy:open-saathi", open);
    return () => window.removeEventListener("vy:open-saathi", open);
  }, []);

  return (
    <div className="shell">
      <a href="#main" className="skip">
        {l("Skip to content", "सीधे सामग्री पर जाएँ", "Seedhe content par jao")}
      </a>
      <Sidebar />
      <div className="shell-main">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main id="main" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <BottomNav onMore={() => setMenuOpen(true)} />
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      {chatOpen ? null : (
        <button
          type="button"
          className="saathi-fab"
          aria-controls="saathi-panel"
          aria-expanded={false}
          onClick={() => setChatOpen(true)}
        >
          <BrandIcon name="saathi" size={32} className="saathi-fab-ic" />
          <span className="saathi-fab-text">
            {l("Saathi", "साथी", "Saathi")}
          </span>
        </button>
      )}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
