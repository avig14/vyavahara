"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useQueryState } from "@/lib/ui/url-state";

export interface TabItem<Id extends string = string> {
  id: Id;
  label: string;
  /** Devanagari sublabel */
  hindi?: string;
}

export interface TabListProps<Id extends string> {
  items: readonly TabItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  /** names the group for screen readers */
  label: string;
  /** id prefix so panels can point back with aria-labelledby */
  idBase: string;
}

/** Controlled tab strip: arrows, Home, End move and select; scrolls sideways instead of wrapping. */
export function TabList<Id extends string>({ items, value, onChange, label, idBase }: TabListProps<Id>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: KeyboardEvent, i: number) {
    const last = items.length - 1;
    let next = -1;
    if (e.key === "ArrowRight") next = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft") next = i === 0 ? last : i - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="tabs-list">
      {items.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            className="tab"
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
            {t.hindi ? (
              <span className="tab-hi deva" lang="hi">
                {t.hindi}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export interface TabsProps<Id extends string> {
  items: readonly TabItem<Id>[];
  /** query key, default `tab` */
  param?: string;
  defaultId: Id;
  label: string;
  /** render the active panel's content */
  children: (active: Id) => ReactNode;
}

/** URL-state tabs: `?tab=` holds the active id (default id leaves the URL clean). */
export function Tabs<Id extends string>({ items, param = "tab", defaultId, label, children }: TabsProps<Id>) {
  const idBase = useId();
  const [active, setActive] = useQueryState<Id>(param, { defaultValue: defaultId, allowed: items.map((t) => t.id) });
  return (
    <div>
      <TabList items={items} value={active} onChange={setActive} label={label} idBase={idBase} />
      <div role="tabpanel" id={`${idBase}-panel-${active}`} aria-labelledby={`${idBase}-tab-${active}`} className="tab-panel">
        {children(active)}
      </div>
    </div>
  );
}
