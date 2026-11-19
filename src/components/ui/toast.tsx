"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "./icons";

export type ToastTone = "neutral" | "success" | "error";

export interface ToastInput {
  /** what happened, in one line */
  title: string;
  detail?: string;
  tone?: ToastTone;
  /** an Undo for reversible actions; keeps the toast up for 8 seconds */
  action?: { label: string; onAction: () => void };
  /** ms; default 5000, 8000 with an action or an error. 0 keeps it until dismissed. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastApi {
  push: (t: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast needs <ToastProvider> above it");
  return api;
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { id, title, detail, tone = "neutral", action, duration } = item;
  const ms = duration ?? (action || tone === "error" ? 8000 : 5000);
  const hold = useRef(false);

  useEffect(() => {
    if (ms === 0) return;
    let left = ms;
    let last = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now();
      if (!hold.current) left -= now - last;
      last = now;
      if (left <= 0) onDismiss(id);
    }, 250);
    return () => window.clearInterval(t);
  }, [id, ms, onDismiss]);

  return (
    <div
      className="toast"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
      onPointerEnter={() => (hold.current = true)}
      onPointerLeave={() => (hold.current = false)}
      onFocus={() => (hold.current = true)}
      onBlur={() => (hold.current = false)}
    >
      <p>
        <span className="toast-title">{title}</span>
        {detail}
      </p>
      {action ? (
        <button
          type="button"
          className="toast-act"
          onClick={() => {
            action.onAction();
            onDismiss(id);
          }}
        >
          {action.label}
        </button>
      ) : (
        <span />
      )}
      <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => onDismiss(id)}>
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

/** Mount once near the root of a screen tree. Toasts are announced politely (errors assertively). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setItems((xs) => [...xs.slice(-3), { ...t, id }]);
    return id;
  }, []);
  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext value={api}>
      {children}
      <div className="toasts" aria-live="polite" aria-relevant="additions">
        {items.map((it) => (
          <ToastView key={it.id} item={it} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}
