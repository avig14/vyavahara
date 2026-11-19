"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger draws the confirm as an outlined red button, never a filled one */
  tone?: "default" | "danger";
  /** request in flight: confirm shows a spinner and the dialog cannot be dismissed */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native `<dialog>` opened with showModal(): focus trap, Escape and backdrop come from the platform. */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Cancel", tone = "default", loading, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dlg"
      aria-labelledby="dlg-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !loading) onCancel();
      }}
    >
      <h2 id="dlg-title" className="dlg-title">
        {title}
      </h2>
      {description ? <div className="dlg-text">{description}</div> : null}
      <div className="dlg-actions">
        <Button variant="quiet" onClick={onCancel} disabled={loading} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

export type ConfirmOptions = Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel" | "loading">;

/** `const { confirm, dialog } = useConfirm(); … if (await confirm({ title, confirmLabel })) …; return <>{dialog}…</>` */
export function useConfirm() {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  const [lastOpts, setLastOpts] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setLastOpts(opts);
        setState({ opts, resolve });
      }),
    [],
  );

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const dialog = lastOpts ? <ConfirmDialog {...lastOpts} open={state !== null} onConfirm={() => close(true)} onCancel={() => close(false)} /> : null;
  return { confirm, dialog };
}
