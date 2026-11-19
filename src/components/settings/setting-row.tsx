"use client";

import type { ReactNode } from "react";
import { Badge, Input, NumberField, PaiseField, Select, Switch } from "@/components/ui";
import { boundsFor, sameValue, type FieldDef } from "./fields";
import { fromPct, hintFor, hourLabel, toPct, type Errors } from "./validate";
import { FestivalsEditor, RecurringEditor } from "./list-editors";

export interface RowProps {
  def: FieldDef;
  value: unknown;
  saved: unknown;
  defaultValue: unknown;
  errors: Errors;
  /** bumped to remount list editors after a discard or reset */
  nonce: number;
  onChange: (path: string, value: unknown) => void;
  onTouch: (key: string) => void;
  onReset: (path: string) => void;
}

function Control({ def, value, id, described, invalid, onChange, onTouch }: { def: FieldDef; value: unknown; id: string; described: string; invalid: boolean; onChange: (v: unknown) => void; onTouch: () => void }) {
  const b = boundsFor(def.path);
  const num = typeof value === "number" ? value : null;
  const common = { id, "aria-describedby": described, invalid, onBlur: onTouch };
  switch (def.kind) {
    case "int":
      return <NumberField {...common} value={num} onChange={onChange} min={b.min} max={b.max} decimals={0} suffix={def.unit} />;
    case "decimal":
      return <NumberField {...common} value={num} onChange={onChange} min={b.min} max={b.max} decimals={def.decimals ?? 2} suffix={def.unit} />;
    case "fraction":
      return (
        <NumberField
          {...common}
          value={num === null ? null : toPct(num)}
          onChange={(p) => onChange(p === null ? null : fromPct(p))}
          min={b.min === undefined ? undefined : toPct(b.min)}
          max={b.max === undefined ? undefined : toPct(b.max)}
          decimals={def.decimals ?? 1}
          suffix="%"
        />
      );
    case "paise":
      return <PaiseField {...common} valuePaise={num} onChangePaise={onChange} minPaise={b.min ?? 0} maxPaise={b.max} />;
    case "hour": {
      const lo = b.min ?? 0;
      const hi = b.max ?? 23;
      const options = Array.from({ length: hi - lo + 1 }, (_, i) => ({ value: String(lo + i), label: hourLabel(lo + i) }));
      return <Select id={id} aria-describedby={described} aria-invalid={invalid || undefined} options={options} value={num === null ? "" : String(num)} onChange={(e) => onChange(Number(e.target.value))} onBlur={onTouch} />;
    }
    case "text":
      return <Input id={id} aria-describedby={described} aria-invalid={invalid || undefined} maxLength={b.maxLength} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} onBlur={onTouch} />;
    case "switch":
      return <Switch id={id} aria-describedby={described} checked={value === true} onChange={onChange} label={def.switchLabel ?? def.label} showState />;
    case "select": {
      const options = (b.options ?? []).map((o) => ({ value: o, label: def.optionLabels?.[o] ?? o }));
      return <Select id={id} aria-describedby={described} options={options} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} onBlur={onTouch} />;
    }
    default:
      return null;
  }
}

/** One setting: name and plain-words description on the left; control, default and any error on the right. */
export function SettingRow({ def, value, saved, defaultValue, errors, nonce, onChange, onTouch, onReset }: RowProps) {
  const id = `f-${def.path}`;
  const helpId = `${id}-help`;
  const descId = `${id}-desc`;
  const wide = def.kind === "recurring" || def.kind === "festivals";
  const changed = !sameValue(value, defaultValue);
  const unsaved = !sameValue(value, saved);
  const error = errors[def.path];
  const hasItemError = Object.keys(errors).some((k) => k.startsWith(`${def.path}.`));

  const badges: ReactNode = (
    <>
      {changed ? <Badge tone="info">Changed</Badge> : null}
      {unsaved ? <Badge tone="warn">Not saved</Badge> : null}
    </>
  );

  const reset = changed ? (
    <button type="button" className="st-reset" onClick={() => onReset(def.path)}>
      Reset to default
    </button>
  ) : null;

  return (
    <div className="st-row" data-wide={wide ? "" : undefined} data-unsaved={unsaved ? "" : undefined}>
      <div className="st-main">
        <div className="st-name">
          {def.kind === "festivals" ? <span id={`${id}-label`}>{def.label}</span> : <label htmlFor={id}>{def.label}</label>}
          {badges}
        </div>
        <p id={descId} className="st-desc">
          {def.description}
        </p>
      </div>
      <div className="st-side">
        {wide ? (
          <>
            {def.kind === "recurring" ? (
              <RecurringEditor key={nonce} id={id} describedBy={`${descId} ${helpId}`} value={value} errors={errors} onChange={(v) => onChange(def.path, v)} onTouch={onTouch} path={def.path} />
            ) : (
              <FestivalsEditor key={nonce} id={id} labelledBy={`${id}-label`} describedBy={`${descId} ${helpId}`} value={value} errors={errors} onChange={(v) => onChange(def.path, v)} onTouch={onTouch} path={def.path} />
            )}
            <div className="st-foot">
              <div id={helpId} className="field-help" data-error={hasItemError ? "" : undefined} role={hasItemError ? "alert" : undefined}>
                {hasItemError ? "Fix the marked entries before saving." : hintFor(def, defaultValue)}
              </div>
              {reset}
            </div>
          </>
        ) : (
          <>
            <Control def={def} value={value} id={id} described={`${descId} ${helpId}`} invalid={Boolean(error)} onChange={(v) => onChange(def.path, v)} onTouch={() => onTouch(def.path)} />
            <div className="st-foot">
              <div id={helpId} className="field-help" data-error={error ? "" : undefined} role={error ? "alert" : undefined}>
                {error ?? hintFor(def, defaultValue)}
              </div>
              {reset}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
