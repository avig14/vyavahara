/** Pure helpers for the Settings form: value formatting, client-side validation, and reading the server's error string. */
import { num, rupees } from "@/lib/format";
import { FIELDS, boundsFor, getAt, type FieldDef, type Tree } from "./fields";

/** path (or list-item path such as `festivals.0.date`) to message */
export type Errors = Record<string, string>;

export interface RecurringCost {
  label: string;
  amountPaise: number;
  dayOfMonth: number;
}

export interface Festival {
  name: string;
  date: string;
  categories: string[];
}

/** 0..1 stored, percent shown. Rounded so 0.9 shows as 90 and 90 goes back as 0.9. */
export const toPct = (v: number): number => Math.round(v * 1000) / 10;
export const fromPct = (p: number): number => Math.round(p * 10) / 1000;

export function hourLabel(h: number): string {
  if (h === 24) return "12:00 am (midnight)";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${h < 12 ? "am" : "pm"}`;
}

function withUnit(def: FieldDef, text: string): string {
  if (!def.unit || def.unit === "weight") return text;
  return def.unit === "%" ? `${text}%` : `${text} ${def.unit}`;
}

/** A stored value as the merchant reads it ("45 days", "90%", "₹2,000"). */
export function formatValue(def: FieldDef, v: unknown): string {
  switch (def.kind) {
    case "int":
    case "decimal":
      return typeof v === "number"
        ? withUnit(def, num(v, def.decimals ?? 0))
        : "none";
    case "fraction":
      return typeof v === "number" ? `${num(toPct(v), 1)}%` : "none";
    case "paise":
      return typeof v === "number" ? rupees(v) : "none";
    case "hour":
      return typeof v === "number" ? hourLabel(v) : "none";
    case "text":
      return typeof v === "string" ? v : "none";
    case "switch":
      return v ? "On" : "Off";
    case "select":
      return typeof v === "string" ? (def.optionLabels?.[v] ?? v) : "none";
    case "recurring":
      return Array.isArray(v)
        ? v.length === 0
          ? "No costs listed"
          : `${v.length} ${v.length === 1 ? "cost" : "costs"}`
        : "Learned from expense history";
    case "festivals":
      return Array.isArray(v) && v.length > 0
        ? `${v.length} ${v.length === 1 ? "festival" : "festivals"}`
        : "None added";
  }
}

/** "Allowed 14 to 365." from the schema's own bounds; empty when the kind has no useful range line. */
export function rangeText(def: FieldDef): string {
  const b = boundsFor(def.path);
  if (def.kind === "int" || def.kind === "decimal" || def.kind === "fraction") {
    if (b.min === undefined || b.max === undefined) return "";
    const lo =
      def.kind === "fraction"
        ? num(toPct(b.min), 1)
        : num(b.min, def.decimals ?? 0);
    const hi =
      def.kind === "fraction"
        ? num(toPct(b.max), 1)
        : num(b.max, def.decimals ?? 0);
    return `Allowed ${lo} to ${hi}.`;
  }
  if (def.kind === "text" && b.maxLength !== undefined)
    return `Up to ${b.maxLength} characters.`;
  return "";
}

/** The helper line under a control when there is no error: the default, then the range. */
export function hintFor(def: FieldDef, defaultValue: unknown): string {
  if (def.kind === "recurring" || def.kind === "festivals")
    return `Default: ${formatValue(def, defaultValue)}.`;
  return [`Default ${formatValue(def, defaultValue)}.`, rangeText(def)]
    .filter(Boolean)
    .join(" ");
}

function numberError(def: FieldDef, v: unknown): string | null {
  if (typeof v !== "number" || Number.isNaN(v)) return "Enter a number.";
  const b = boundsFor(def.path);
  if (
    (b.int ||
      def.kind === "int" ||
      def.kind === "paise" ||
      def.kind === "hour") &&
    !Number.isInteger(v)
  )
    return "Use a whole number.";
  if (b.min !== undefined && v < b.min)
    return `Lowest allowed is ${formatValue(def, b.min)}.`;
  if (b.max !== undefined && v > b.max)
    return `Highest allowed is ${formatValue(def, b.max)}.`;
  return null;
}

function checkField(def: FieldDef, v: unknown): string | null {
  switch (def.kind) {
    case "int":
    case "decimal":
    case "fraction":
    case "paise":
    case "hour":
      return numberError(def, v);
    case "text": {
      const b = boundsFor(def.path);
      if (typeof v !== "string" || v.length < (b.minLength ?? 1))
        return "Enter a name.";
      if (b.maxLength !== undefined && v.length > b.maxLength)
        return `Keep it to ${b.maxLength} characters or fewer.`;
      return null;
    }
    case "select": {
      const b = boundsFor(def.path);
      return typeof v === "string" && (!b.options || b.options.includes(v))
        ? null
        : "Pick one of the options.";
    }
    default:
      return null;
  }
}

function checkRecurring(base: string, v: unknown, out: Errors): void {
  if (!Array.isArray(v)) return;
  const label = boundsFor(`${base}.*.label`);
  const day = boundsFor(`${base}.*.dayOfMonth`);
  v.forEach((row: Partial<RecurringCost>, i) => {
    const k = `${base}.${i}`;
    if (
      typeof row.label !== "string" ||
      row.label.length < (label.minLength ?? 1)
    )
      out[`${k}.label`] = "Name this cost.";
    else if (
      label.maxLength !== undefined &&
      row.label.length > label.maxLength
    )
      out[`${k}.label`] = `Keep it to ${label.maxLength} characters or fewer.`;
    if (typeof row.amountPaise !== "number" || Number.isNaN(row.amountPaise))
      out[`${k}.amountPaise`] = "Enter an amount.";
    else if (row.amountPaise < 0)
      out[`${k}.amountPaise`] = "Cannot be below ₹0.";
    if (typeof row.dayOfMonth !== "number" || Number.isNaN(row.dayOfMonth))
      out[`${k}.dayOfMonth`] = "Enter a day.";
    else if (
      !Number.isInteger(row.dayOfMonth) ||
      (day.min !== undefined && row.dayOfMonth < day.min) ||
      (day.max !== undefined && row.dayOfMonth > day.max)
    )
      out[`${k}.dayOfMonth`] =
        `Pick a day from ${day.min ?? 1} to ${day.max ?? 31}.`;
  });
}

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function checkFestivals(base: string, v: unknown, out: Errors): void {
  if (!Array.isArray(v)) return;
  const name = boundsFor(`${base}.*.name`);
  const cats = boundsFor(`${base}.*.categories`);
  v.forEach((row: Partial<Festival>, i) => {
    const k = `${base}.${i}`;
    if (typeof row.name !== "string" || row.name.length < (name.minLength ?? 1))
      out[`${k}.name`] = "Name this festival.";
    else if (name.maxLength !== undefined && row.name.length > name.maxLength)
      out[`${k}.name`] = `Keep it to ${name.maxLength} characters or fewer.`;
    if (typeof row.date !== "string" || !isRealDate(row.date))
      out[`${k}.date`] = "Pick a date.";
    if (!Array.isArray(row.categories))
      out[`${k}.categories`] = "List the item categories.";
    else if (
      cats.maxItems !== undefined &&
      row.categories.length > cats.maxItems
    )
      out[`${k}.categories`] = `List at most ${cats.maxItems} categories.`;
  });
}

/** Everything the server would reject, found before sending: per-field bounds, list rows, and the two cross-field rules. */
export function validate(draft: Tree): Errors {
  const out: Errors = {};
  for (const def of FIELDS) {
    const v = getAt(draft, def.path);
    const msg = checkField(def, v);
    if (msg) out[def.path] = msg;
    if (def.kind === "recurring") checkRecurring(def.path, v, out);
    if (def.kind === "festivals") checkFestivals(def.path, v, out);
  }
  const green = getAt(draft, "khata.greenMax");
  const amber = getAt(draft, "khata.amberMax");
  if (
    typeof green === "number" &&
    typeof amber === "number" &&
    green >= amber &&
    !out["khata.amberMax"]
  )
    out["khata.amberMax"] = `Must be above the green limit (${num(green)}).`;
  const from = getAt(draft, "alerts.sendFromHour");
  const until = getAt(draft, "alerts.sendUntilHour");
  if (
    typeof from === "number" &&
    typeof until === "number" &&
    from >= until &&
    !out["alerts.sendUntilHour"]
  )
    out["alerts.sendUntilHour"] = "Must be later than the start hour.";
  return out;
}

/** True when `key` is the field path itself or a list-item path under it. */
export function underPath(key: string, path: string): boolean {
  return key === path || key.startsWith(`${path}.`);
}

/** The field a (possibly list-item) error key belongs to, or undefined when no field here owns it. */
export function ownerOf(key: string): string | undefined {
  return FIELDS.find((f) => underPath(key, f.path))?.path;
}

export interface ServerErrors {
  fields: Errors;
  /** messages no field here owns */
  other: string[];
}

/**
 * `PUT /api/settings` answers 400 `{ error }` where error is "path: message; path: message", or
 * "khata.greenMax must be below khata.amberMax" for the two cross-field rules. Split it back into fields.
 */
export function parseServerError(error: string): ServerErrors {
  const fields: Errors = {};
  const other: string[] = [];
  for (const part of error.split("; ")) {
    const text = part.trim();
    if (!text) continue;
    if (text.startsWith("khata.greenMax must be below")) {
      fields["khata.amberMax"] = "Must be above the green limit.";
      continue;
    }
    if (text.startsWith("alerts.sendFromHour must be before")) {
      fields["alerts.sendUntilHour"] = "Must be later than the start hour.";
      continue;
    }
    const m = /^([A-Za-z][\w.]*):\s*(.*)$/.exec(text);
    if (m && ownerOf(m[1])) fields[m[1]] = m[2] || "Not accepted.";
    else other.push(text);
  }
  return { fields, other };
}
