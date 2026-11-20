"use client";

import { useEffect, useRef } from "react";
import { useL } from "@/lib/ui/lang";
import { BrandIcon } from "@/components/ui/brand-icon";
import { IconButton } from "@/components/ui/icon-button";
import { CloseIcon } from "@/components/ui/icons";
import { ChatBody } from "./chat-body";
export interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

const PHONE = "(max-width: 60rem)";

/**
 * Floating Saathi panel. Closed by default; the top bar toggles it. On a phone it opens as a modal
 * sheet (native focus trap, Escape closes); on a wide screen it floats bottom right without blocking the page.
 * Takes no children: the body lives in `chat-body.tsx`.
 */
export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const l = useL();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      if (window.matchMedia(PHONE).matches) d.showModal();
      else d.show();
    } else if (!open && d.open) {
      d.close();
      if (opener.current instanceof HTMLElement && opener.current.isConnected)
        opener.current.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      id="saathi-panel"
      className="chat"
      aria-labelledby="saathi-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="chat-head">
        <h2 id="saathi-title" className="chat-title">
          <BrandIcon name="saathi" size={28} className="btn-ic" />
          {l("Saathi", "साथी", "Saathi")}
        </h2>
        <IconButton
          label={l("Close Saathi", "साथी बंद करें", "Saathi band karo")}
          onClick={onClose}
        >
          <CloseIcon size={18} />
        </IconButton>
      </div>
      <div className="chat-body">
        <ChatBody />
      </div>
    </dialog>
  );
}
