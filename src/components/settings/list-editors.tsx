"use client";

import { useState, type ReactNode } from "react";
import { Button, Input, NumberField, PaiseField, Switch } from "@/components/ui";
import { boundsFor } from "./fields";
import type { Errors, Festival, RecurringCost } from "./validate";

interface EditorProps {
  id: string;
  path: string;
  value: unknown;
  errors: Errors;
  describedBy: string;
  labelledBy?: string;
  onChange: (value: unknown) => void;
  onTouch: (key: string) => void;
}

function focusLater(id: string) {
  window.requestAnimationFrame(() => document.getElementById(id)?.focus());
}

interface CellProps {
  id: string;
  label: string;
  error?: string;
  children: (p: { id: string; "aria-describedby": string; invalid: boolean }) => ReactNode;
}

type CellProps_ = { id: string; "aria-describedby": string; invalid: boolean };
/** Props a plain `Input` accepts (it has no `invalid` prop; it reads aria-invalid). */
const ia = (p: CellProps_) => ({ id: p.id, "aria-describedby": p["aria-describedby"], "aria-invalid": p.invalid || undefined });

/** Label, control and an error line of its own, for a cell inside a list row. */
function Cell({ id, label, error, children }: CellProps) {
  return (
    <div className="field st-cell">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children({ id, "aria-describedby": `${id}-help`, invalid: Boolean(error) })}
      <div id={`${id}-help`} className="field-help" data-error={error ? "" : undefined} role={error ? "alert" : undefined}>
        {error}
      </div>
    </div>
  );
}

/* ---------------- cash.recurring ---------------- */

export function RecurringEditor({ id, path, value, errors, describedBy, onChange, onTouch }: EditorProps) {
  const rows = Array.isArray(value) ? (value as RecurringCost[]) : null;
  const label = boundsFor(`${path}.*.label`);
  const day = boundsFor(`${path}.*.dayOfMonth`);

  const patch = (i: number, p: Partial<RecurringCost>) => onChange((rows ?? []).map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <div className="st-list">
      <Switch id={id} aria-describedby={describedBy} checked={rows !== null} onChange={(on) => onChange(on ? [] : null)} label="Use my own list" hint={rows === null ? "Vyavahāra reads rent, salary and electricity from your expenses." : "Only the costs below are used."} showState />
      {rows !== null ? (
        <>
          {rows.length === 0 ? <p className="st-list-empty">No costs yet. Add rent, salary or electricity, with the day of the month it falls due.</p> : null}
          {rows.map((r, i) => {
            const k = `${path}.${i}`;
            return (
              <div className="st-list-row st-cost" key={i} role="group" aria-label={`Cost ${i + 1}`}>
                <Cell id={`f-${k}.label`} label="Name" error={errors[`${k}.label`]}>
                  {(p) => <Input {...ia(p)} maxLength={label.maxLength} value={r.label} onChange={(e) => patch(i, { label: e.target.value })} onBlur={() => onTouch(`${k}.label`)} />}
                </Cell>
                <Cell id={`f-${k}.amountPaise`} label="Amount each month" error={errors[`${k}.amountPaise`]}>
                  {(p) => <PaiseField {...p} valuePaise={Number.isFinite(r.amountPaise) ? r.amountPaise : null} onChangePaise={(v) => patch(i, { amountPaise: v as number })} onBlur={() => onTouch(`${k}.amountPaise`)} />}
                </Cell>
                <Cell id={`f-${k}.dayOfMonth`} label="Day of month" error={errors[`${k}.dayOfMonth`]}>
                  {(p) => <NumberField {...p} value={Number.isFinite(r.dayOfMonth) ? r.dayOfMonth : null} onChange={(v) => patch(i, { dayOfMonth: v as number })} min={day.min} max={day.max} decimals={0} onBlur={() => onTouch(`${k}.dayOfMonth`)} />}
                </Cell>
                <div className="st-list-x">
                  <Button variant="quiet" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove cost ${i + 1}`}>
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="st-list-add">
            <Button
              variant="secondary"
              onClick={() => {
                onChange([...rows, { label: "", amountPaise: 0, dayOfMonth: 1 }]);
                focusLater(`f-${path}.${rows.length}.label`);
              }}
            >
              Add a cost
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ---------------- festivals ---------------- */

/** Comma-separated categories. Keeps what is typed until blur so a trailing comma is not eaten. */
function CategoriesInput({ value, onChange, onBlur, ...aria }: { value: string[]; onChange: (v: string[]) => void; onBlur: () => void; id: string; "aria-describedby": string; invalid: boolean }) {
  const { invalid, ...rest } = aria;
  const [text, setText] = useState(value.join(", "));
  return (
    <Input
      {...rest}
      aria-invalid={invalid || undefined}
      value={text}
      placeholder="sweets, dry_fruits"
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
      onBlur={() => {
        setText(value.join(", "));
        onBlur();
      }}
    />
  );
}

export function FestivalsEditor({ id, path, value, errors, describedBy, labelledBy, onChange, onTouch }: EditorProps) {
  const rows = Array.isArray(value) ? (value as Festival[]) : [];
  const name = boundsFor(`${path}.*.name`);
  // stable keys so a removed row does not hand its typed category text to the row below it
  const [ids, setIds] = useState<number[]>(() => rows.map((_, i) => i));
  const keys = ids.length === rows.length ? ids : rows.map((_, i) => i);

  const patch = (i: number, p: Partial<Festival>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <div className="st-list" id={id} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {rows.length === 0 ? <p className="st-list-empty">None added. The built-in festival calendar still applies.</p> : null}
      {rows.map((r, i) => {
        const k = `${path}.${i}`;
        return (
          <div className="st-list-row st-fest" key={keys[i]} role="group" aria-label={`Festival ${i + 1}`}>
            <Cell id={`f-${k}.name`} label="Name" error={errors[`${k}.name`]}>
              {(p) => <Input {...ia(p)} maxLength={name.maxLength} value={r.name} onChange={(e) => patch(i, { name: e.target.value })} onBlur={() => onTouch(`${k}.name`)} />}
            </Cell>
            <Cell id={`f-${k}.date`} label="Date" error={errors[`${k}.date`]}>
              {(p) => <Input {...ia(p)} type="date" value={r.date} onChange={(e) => patch(i, { date: e.target.value })} onBlur={() => onTouch(`${k}.date`)} />}
            </Cell>
            <Cell id={`f-${k}.categories`} label="Item categories" error={errors[`${k}.categories`]}>
              {(p) => <CategoriesInput {...p} value={r.categories} onChange={(v) => patch(i, { categories: v })} onBlur={() => onTouch(`${k}.categories`)} />}
            </Cell>
            <div className="st-list-x">
              <Button
                variant="quiet"
                onClick={() => {
                  setIds(keys.filter((_, j) => j !== i));
                  onChange(rows.filter((_, j) => j !== i));
                }}
                aria-label={`Remove festival ${i + 1}`}
              >
                Remove
              </Button>
            </div>
          </div>
        );
      })}
      <div className="st-list-add">
        <Button
          variant="secondary"
          onClick={() => {
            setIds([...keys, Math.max(-1, ...keys) + 1]);
            onChange([...rows, { name: "", date: "", categories: [] }]);
            focusLater(`f-${path}.${rows.length}.name`);
          }}
        >
          Add a festival
        </Button>
      </div>
    </div>
  );
}
