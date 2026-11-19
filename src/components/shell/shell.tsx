"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { CloseIcon } from "@/components/ui/icons";
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

/** Client frame of the dashboard: sidebar, top bar, phone menu drawer, Saathi panel. Page content is `children`. */
export function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="shell">
      <a href="#main" className="skip">
        Skip to content
      </a>
      <Sidebar />
      <div className="shell-main">
        <Topbar chatOpen={chatOpen} onToggleChat={() => setChatOpen((o) => !o)} onOpenMenu={() => setMenuOpen(true)} />
        <main id="main" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
