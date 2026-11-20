"use client";

import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { L } from "@/lib/ui/lang";

/**
 * Shared interaction for every chart: one active mark at a time, set by mouse hover, a tap on a phone, or the arrow keys.
 * The tooltip is positioned from the mark's own geometry, so it is the same for pointer, touch and keyboard.
 */
export function useActiveMark(
  count: number,
  root: RefObject<HTMLDivElement | null>,
) {
  const [active, setActive] = useState<number | null>(null);

  // a tap elsewhere closes a touch tooltip
  useEffect(() => {
    if (active === null) return;
    const away = (e: Event) => {
      if (root.current && !root.current.contains(e.target as Node))
        setActive(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [active, root]);

  const bind = useCallback(
    (i: number) => ({
      onPointerEnter: (e: PointerEvent) => {
        if (e.pointerType === "mouse") setActive(i);
      },
      onPointerLeave: (e: PointerEvent) => {
        if (e.pointerType === "mouse") setActive((a) => (a === i ? null : a));
      },
      onPointerDown: (e: PointerEvent) => {
        if (e.pointerType !== "mouse") setActive((a) => (a === i ? null : i));
      },
    }),
    [],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (count === 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a === null ? 0 : Math.min(count - 1, a + 1)));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a === null ? count - 1 : Math.max(0, a - 1)));
      } else if (e.key === "Home") setActive(0);
      else if (e.key === "End") setActive(count - 1);
      else if (e.key === "Escape") setActive(null);
    },
    [count],
  );

  return { active, setActive, bind, onKeyDown };
}

export interface TipProps {
  /** anchor in px inside the chart box */
  x: number;
  y: number;
  /** width of the chart box, to keep the tip inside it */
  boxW: number;
  title: string;
  value?: string;
  lines?: readonly string[];
}

/** The readout: what this mark is, its exact value, and what it means. Never intercepts the pointer. */
export function Tip({ x, y, boxW, title, value, lines = [] }: TipProps) {
  const half = 104;
  const left =
    boxW === 0 ? 0 : Math.min(Math.max(x, half), Math.max(half, boxW - half));
  const below = y > 0 && y < 120;
  return (
    <div
      className="ct"
      data-below={below ? "" : undefined}
      style={{ left, top: y }}
      role="presentation"
    >
      <p className="ct-title">{title}</p>
      {value ? <p className="ct-value">{value}</p> : null}
      {lines.map((t) => (
        <p key={t} className="ct-line">
          {t}
        </p>
      ))}
    </div>
  );
}

/** "How to read this": one plain sentence under a chart. */
export function ChartHint({ children }: { children: ReactNode }) {
  return <p className="chart-hint">{children}</p>;
}

/** Screen-reader mirror of the tooltip, so keyboard users hear what sighted users see. */
export function Live({ text }: { text: string }) {
  return (
    <p className="visually-hidden" role="status" aria-live="polite">
      {text}
    </p>
  );
}

/** Rank, versus-average and versus-previous lines for a series of bars or points. */
export function compareLines(
  values: readonly number[],
  labels: readonly string[],
  i: number,
  format: (v: number) => string,
  l: L,
): string[] {
  const n = values.length;
  const v = values[i];
  const out: string[] = [];
  if (n > 1) {
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (v === max)
      out.push(
        l(
          `Highest of these ${n}`,
          `इन ${n} में सबसे ज़्यादा`,
          `In ${n} mein sabse zyada`,
        ),
      );
    else if (v === min)
      out.push(
        l(`Lowest of these ${n}`, `इन ${n} में सबसे कम`, `In ${n} mein sabse kam`),
      );
    const avg = values.reduce((a, b) => a + b, 0) / n;
    if (avg !== 0) {
      const pct = Math.round(((v - avg) / Math.abs(avg)) * 100);
      if (Math.abs(pct) < 3)
        out.push(
          l(
            `About the average (${format(avg)})`,
            `औसत के आसपास (${format(avg)})`,
            `Average ke aaspaas (${format(avg)})`,
          ),
        );
      else
        out.push(
          l(
            `${Math.abs(pct)}% ${pct > 0 ? "above" : "below"} the average (${format(avg)})`,
            `औसत (${format(avg)}) से ${Math.abs(pct)}% ${pct > 0 ? "ज़्यादा" : "कम"}`,
            `Average (${format(avg)}) se ${Math.abs(pct)}% ${pct > 0 ? "zyada" : "kam"}`,
          ),
        );
    }
  }
  if (i > 0) {
    const d = v - values[i - 1];
    if (d === 0)
      out.push(
        l(
          `Same as ${labels[i - 1]}`,
          `${labels[i - 1]} जितना ही`,
          `${labels[i - 1]} jitna hi`,
        ),
      );
    else
      out.push(
        l(
          `${format(Math.abs(d))} ${d > 0 ? "more" : "less"} than ${labels[i - 1]}`,
          `${labels[i - 1]} से ${format(Math.abs(d))} ${d > 0 ? "ज़्यादा" : "कम"}`,
          `${labels[i - 1]} se ${format(Math.abs(d))} ${d > 0 ? "zyada" : "kam"}`,
        ),
      );
  }
  return out;
}
