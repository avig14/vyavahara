"use client";

import { createContext, useContext, useId, useState, type ComponentProps, type ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { toPaise } from "@/lib/format";
import { ChevronDownIcon } from "./icons";

interface FieldCtx {
  id: string;
  describedBy: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldCtx | null>(null);

interface OwnAria {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  required?: boolean;
}

function useFieldProps(own: OwnAria) {
  const f = useContext(FieldContext);
  const required = own.required ?? f?.required;
  return {
    id: own.id ?? f?.id,
    "aria-describedby": own["aria-describedby"] ?? f?.describedBy,
    "aria-invalid": own["aria-invalid"] ?? (f?.invalid ? true : undefined),
    "aria-required": required ? true : undefined,
  };
}

export interface FieldProps {
  label: string;
  /** helper line; replaced by `error` when there is one. The line always reserves its height, so nothing jumps. */
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  /** extra text on the label row, right side (a unit note, a link) */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + helper/error. Input, Select, Textarea, NumberField and PaiseField read their id and aria from it. */
export function Field({ label, hint, error, required, aside, className, children }: FieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <FieldContext value={{ id, describedBy: helpId, invalid: Boolean(error), required: Boolean(required) }}>
      <div className={cx("field", className)}>
        <label htmlFor={id} className="field-label">
          <span>
            {label}
            {required ? <span className="field-req"> (required)</span> : null}
          </span>
          {aside}
        </label>
        {children}
        <div id={helpId} className="field-help" data-error={error ? "" : undefined} role={error ? "alert" : undefined}>
          {error ?? hint}
        </div>
      </div>
    </FieldContext>
  );
}

export type InputProps = ComponentProps<"input">;

export function Input({ className, ...rest }: InputProps) {
  const a = useFieldProps(rest);
  return <input className={cx("ctl", className)} {...rest} {...a} />;
}

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea({ className, ...rest }: TextareaProps) {
  const a = useFieldProps(rest);
  return <textarea className={cx("ctl", className)} {...rest} {...a} />;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentProps<"select">, "children"> {
  options: readonly SelectOption[];
}

export function Select({ options, className, ...rest }: SelectProps) {
  const a = useFieldProps(rest);
  return (
    <div className="sel">
      <select className={cx("ctl", className)} {...rest} {...a}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={16} />
    </div>
  );
}

export interface SwitchProps extends Omit<ComponentProps<"input">, "type" | "onChange" | "checked" | "children"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  /** show the words On / Off at the right edge, so state is never colour alone */
  showState?: boolean;
}

export function Switch({ checked, onChange, label, hint, showState = false, className, disabled, ...rest }: SwitchProps) {
  return (
    <label className={cx("sw", className)} data-disabled={disabled ? "" : undefined}>
      <input {...rest} type="checkbox" role="switch" className="sw-input" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="sw-text">
        <span className="sw-label">{label}</span>
        {hint ? <span className="sw-hint">{hint}</span> : null}
      </span>
      {showState ? <span className="sw-state">{checked ? "On" : "Off"}</span> : null}
    </label>
  );
}

export interface NumberFieldProps extends Omit<ComponentProps<"input">, "type" | "value" | "onChange" | "min" | "max" | "step" | "prefix"> {
  /** `null` is an empty box */
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  /** allowed decimals while typing; 0 means whole numbers only */
  decimals?: number;
  /** shown before the number, e.g. "₹" */
  prefix?: string;
  /** shown after the number, e.g. "%", "days" */
  suffix?: string;
  invalid?: boolean;
}

function parseNumber(text: string, decimals: number): number | null {
  const t = text.replace(/,/g, "").trim();
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function allowedTyping(text: string, decimals: number, allowNegative: boolean): boolean {
  const sign = allowNegative ? "-?" : "";
  const re = decimals > 0 ? new RegExp(`^${sign}[0-9,]*\\.?[0-9]{0,${decimals}}$`) : new RegExp(`^${sign}[0-9,]*$`);
  return re.test(text);
}

/** Text box that holds a number: keeps what the user types until blur, then snaps to a clamped value. */
export function NumberField({ value, onChange, min, max, decimals = 0, prefix, suffix, invalid, className, disabled, onBlur, ...rest }: NumberFieldProps) {
  const a = useFieldProps({ ...rest, "aria-invalid": invalid ? true : rest["aria-invalid"] });
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? "" : String(value));
  const isInvalid = a["aria-invalid"] === true || a["aria-invalid"] === "true";

  return (
    <div className={cx("nf", className)} data-invalid={isInvalid ? "" : undefined} data-disabled={disabled ? "" : undefined}>
      {prefix ? (
        <span className="nf-unit" data-side="prefix" aria-hidden="true">
          {prefix}
        </span>
      ) : null}
      <input
        {...rest}
        {...a}
        className="nf-input"
        type="text"
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        autoComplete="off"
        disabled={disabled}
        value={shown}
        onChange={(e) => {
          const v = e.target.value;
          if (!allowedTyping(v, decimals, min === undefined || min < 0)) return;
          setText(v);
          onChange(parseNumber(v, decimals));
        }}
        onBlur={(e) => {
          const n = parseNumber(shown, decimals);
          if (n !== null) {
            const c = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
            if (c !== n) onChange(c);
          }
          setText(null);
          onBlur?.(e);
        }}
      />
      {suffix ? (
        <span className="nf-unit" data-side="suffix" aria-hidden="true">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export interface PaiseFieldProps extends Omit<NumberFieldProps, "value" | "onChange" | "decimals" | "prefix" | "suffix" | "min" | "max"> {
  /** integer paise, as the API stores it; `null` is empty */
  valuePaise: number | null;
  /** integer paise out */
  onChangePaise: (paise: number | null) => void;
  minPaise?: number;
  maxPaise?: number;
}

/** Shows rupees (₹), emits integer paise. Conversion goes through `toPaise` in `src/lib/format.ts`. */
export function PaiseField({ valuePaise, onChangePaise, minPaise = 0, maxPaise, ...rest }: PaiseFieldProps) {
  return (
    <NumberField
      {...rest}
      prefix="₹"
      decimals={2}
      value={valuePaise === null ? null : valuePaise / 100}
      min={minPaise / 100}
      max={maxPaise === undefined ? undefined : maxPaise / 100}
      onChange={(r) => onChangePaise(r === null ? null : toPaise(r))}
    />
  );
}
