/**
 * What the Settings screen shows for every key in `src/lib/settings.ts`: label, words, unit, kind.
 * Bounds are NOT written here: they are read from `settingsSchema` itself (see `boundsFor`), so the form can never
 * disagree with the server. A key present in the API's `defaults` but missing from `FIELDS` is reported by
 * `findUnmapped` and the screen draws a visible "unmapped setting" row for it, so nothing is silently left out.
 */
import { z } from "zod";
import { settingsSchema } from "@/lib/settings";

export type FieldKind =
  | "int" // whole number
  | "decimal" // number with decimals
  | "fraction" // stored 0..1, shown as a percent
  | "paise" // integer paise, shown as rupees
  | "text"
  | "switch"
  | "select"
  | "hour" // whole hour of the day, 0..24
  | "recurring" // cash.recurring list (null = learn from history)
  | "festivals"; // festivals list

export interface GroupDef {
  id: string;
  title: string;
  hindi?: string;
  description: string;
}

export interface FieldDef {
  /** dotted path into the settings object, e.g. "khata.weights.oldest" */
  path: string;
  group: string;
  /** sub-heading inside a group */
  cluster?: string;
  label: string;
  description: string;
  kind: FieldKind;
  /** shown after the number, and in "Default 7 days" */
  unit?: string;
  /** decimals allowed while typing (decimal and fraction kinds) */
  decimals?: number;
  /** label of the switch itself (switch kind) */
  switchLabel?: string;
  /** select kind: value to label */
  optionLabels?: Record<string, string>;
}

export const GROUPS: readonly GroupDef[] = [
  {
    id: "inventory",
    title: "Stock",
    hindi: "स्टॉक",
    description:
      "How much cover to hold, and when stock counts as too much or dead.",
  },
  {
    id: "khata",
    title: "Khata",
    hindi: "खाता",
    description:
      "How a customer's risk score is worked out, and the limits that follow from it.",
  },
  {
    id: "cash",
    title: "Cash",
    hindi: "नकद",
    description: "The starting point for the cash projection.",
  },
  {
    id: "anomalies",
    title: "Unusual sales",
    description:
      "When a day, a refund or an item is flagged as out of the ordinary.",
  },
  {
    id: "customers",
    title: "Customers",
    hindi: "ग्राहक",
    description: "What makes a customer regular, new or lapsed.",
  },
  {
    id: "gst",
    title: "GST",
    description: "The rate used for the composition scheme.",
  },
  {
    id: "loan",
    title: "Loan",
    hindi: "लोन",
    description: "The checks behind the indicative loan range.",
  },
  {
    id: "recommendations",
    title: "Recommendations",
    description: "The cut-offs that decide what Vyavahāra suggests.",
  },
  {
    id: "ingest",
    title: "Bills and payments",
    description:
      "How strictly bills, soundbox baskets and payment screenshots are matched.",
  },
  {
    id: "alerts",
    title: "Alerts",
    description: "Which proactive messages go out, and when.",
  },
  {
    id: "calls",
    title: "Call Saathi",
    hindi: "कॉल साथी",
    description: "Automatic reminder calls for udhaar that stays unpaid.",
  },
  {
    id: "festivals",
    title: "Festivals",
    hindi: "त्योहार",
    description: "Festivals you care about, added to the built-in calendar.",
  },
  {
    id: "language",
    title: "Language",
    hindi: "भाषा",
    description: "The language Vyavahāra writes in.",
  },
];

export const FIELDS: readonly FieldDef[] = [
  // ---- stock
  {
    path: "inventory.serviceLevelZ",
    group: "inventory",
    label: "Safety stock cushion",
    kind: "decimal",
    decimals: 2,
    unit: "z-score",
    description:
      "Spare stock to keep against a busy day. 1.28 covers about 90% of days, 1.65 about 95%, 2.05 about 98%. Higher keeps more spare stock.",
  },
  {
    path: "inventory.reviewBufferDays",
    group: "inventory",
    label: "Extra days to order for",
    kind: "int",
    unit: "days",
    description:
      "A suggested order buys this many days of stock on top of the supplier's lead time.",
  },
  {
    path: "inventory.overstockCoverDays",
    group: "inventory",
    label: "Overstock after",
    kind: "int",
    unit: "days",
    description:
      "An item is flagged as overstock when its stock would last longer than this.",
  },
  {
    path: "inventory.deadStockDays",
    group: "inventory",
    label: "Dead stock after",
    kind: "int",
    unit: "days",
    description:
      "An item is flagged as dead stock when nothing has sold for this long.",
  },
  {
    path: "inventory.horizonDays",
    group: "inventory",
    label: "Forecast horizon",
    kind: "int",
    unit: "days",
    description: "How many days ahead the forecast on the dashboard looks.",
  },

  // ---- khata
  {
    path: "khata.weights.oldest",
    group: "khata",
    cluster: "Risk score weights",
    label: "Oldest unpaid amount",
    kind: "decimal",
    decimals: 1,
    unit: "weight",
    description:
      "How much the age of the oldest unpaid balance counts in the score.",
  },
  {
    path: "khata.weights.repay",
    group: "khata",
    cluster: "Risk score weights",
    label: "Repayment record",
    kind: "decimal",
    decimals: 1,
    unit: "weight",
    description: "How much the customer's record of repaying counts.",
  },
  {
    path: "khata.weights.utilization",
    group: "khata",
    cluster: "Risk score weights",
    label: "Limit used",
    kind: "decimal",
    decimals: 1,
    unit: "weight",
    description:
      "How much the share of the credit limit already in use counts.",
  },
  {
    path: "khata.weights.lastPayment",
    group: "khata",
    cluster: "Risk score weights",
    label: "Time since last payment",
    kind: "decimal",
    decimals: 1,
    unit: "weight",
    description: "How much a long gap since the last payment counts.",
  },
  {
    path: "khata.weights.growing",
    group: "khata",
    cluster: "Risk score weights",
    label: "Growing balance",
    kind: "decimal",
    decimals: 1,
    unit: "weight",
    description: "How much a balance that keeps growing counts.",
  },
  {
    path: "khata.oldestFullDays",
    group: "khata",
    cluster: "When a part counts fully",
    label: "Oldest balance counts fully at",
    kind: "int",
    unit: "days",
    description:
      "At this many days unpaid, the oldest-balance part of the score is at its maximum.",
  },
  {
    path: "khata.lastPaymentFullDays",
    group: "khata",
    cluster: "When a part counts fully",
    label: "Last payment counts fully at",
    kind: "int",
    unit: "days",
    description:
      "At this many days since the last payment, that part of the score is at its maximum.",
  },
  {
    path: "khata.greenMax",
    group: "khata",
    cluster: "Score bands",
    label: "Green up to score",
    kind: "int",
    unit: "points",
    description:
      "A score at or below this is green. Must be below the amber limit.",
  },
  {
    path: "khata.amberMax",
    group: "khata",
    cluster: "Score bands",
    label: "Amber up to score",
    kind: "int",
    unit: "points",
    description: "A score at or below this is amber; anything higher is red.",
  },
  {
    path: "khata.recovery.green",
    group: "khata",
    cluster: "Expected recovery",
    label: "From green customers",
    kind: "fraction",
    decimals: 1,
    unit: "%",
    description:
      "Share of what a green customer owes that is expected to come back.",
  },
  {
    path: "khata.recovery.amber",
    group: "khata",
    cluster: "Expected recovery",
    label: "From amber customers",
    kind: "fraction",
    decimals: 1,
    unit: "%",
    description:
      "Share of what an amber customer owes that is expected to come back.",
  },
  {
    path: "khata.recovery.red",
    group: "khata",
    cluster: "Expected recovery",
    label: "From red customers",
    kind: "fraction",
    decimals: 1,
    unit: "%",
    description:
      "Share of what a red customer owes that is expected to come back.",
  },
  {
    path: "khata.limitMultiplier",
    group: "khata",
    cluster: "Credit limits",
    label: "Suggested limit for green customers",
    kind: "decimal",
    decimals: 2,
    unit: "times",
    description:
      "The suggested limit is this many times the customer's monthly purchases.",
  },
  {
    path: "khata.defaultLimitPaise",
    group: "khata",
    cluster: "Credit limits",
    label: "Limit for a new khata customer",
    kind: "paise",
    description: "The credit limit a brand-new khata customer starts with.",
  },

  // ---- cash
  {
    path: "cash.openingBalancePaise",
    group: "cash",
    label: "Cash in hand plus bank",
    kind: "paise",
    description:
      "What you hold at the start of the projection. Leave it at 0 if you do not know it.",
  },
  {
    path: "cash.minBufferPaise",
    group: "cash",
    label: "Keep at least",
    kind: "paise",
    description: "The least you want left after paying suppliers.",
  },
  {
    path: "cash.collectionDays",
    group: "cash",
    label: "Khata comes back over",
    kind: "int",
    unit: "days",
    description:
      "Outstanding khata is assumed to come back over this many days.",
  },
  {
    path: "cash.recurring",
    group: "cash",
    label: "Fixed monthly costs",
    kind: "recurring",
    description:
      "Rent, salary, electricity. Off means Vyavahāra learns them from your expense history; on means your list replaces that.",
  },

  // ---- unusual sales
  {
    path: "anomalies.zThreshold",
    group: "anomalies",
    label: "How unusual a day must be",
    kind: "decimal",
    decimals: 2,
    unit: "z-score",
    description:
      "How far from the usual a day's sales must be to be flagged. Lower flags more days.",
  },
  {
    path: "anomalies.salesDipPct",
    group: "anomalies",
    label: "Sales dip that is flagged",
    kind: "fraction",
    decimals: 1,
    unit: "%",
    description:
      "A drop this large against the usual is flagged too, because sales part-way through a day are noisy.",
  },
  {
    path: "anomalies.refundMultiple",
    group: "anomalies",
    label: "Refund spike",
    kind: "decimal",
    decimals: 1,
    unit: "times",
    description: "Refunds this many times the usual are flagged.",
  },
  {
    path: "anomalies.itemDropShare",
    group: "anomalies",
    label: "Item slump",
    kind: "fraction",
    decimals: 1,
    unit: "%",
    description:
      "An item is flagged when it sells below this share of its forecast for 3 days.",
  },

  // ---- customers
  {
    path: "customers.regularVisits",
    group: "customers",
    label: "Regular customer needs",
    kind: "int",
    unit: "visit days",
    description:
      "At least this many days with a visit, within the window below.",
  },
  {
    path: "customers.regularWindowDays",
    group: "customers",
    label: "Window for regular visits",
    kind: "int",
    unit: "days",
    description: "The stretch of days in which those visits are counted.",
  },
  {
    path: "customers.newDays",
    group: "customers",
    label: "New customer for",
    kind: "int",
    unit: "days",
    description:
      "A customer counts as new when first seen this many days ago or fewer.",
  },
  {
    path: "customers.lapsedDays",
    group: "customers",
    label: "Lapsed after",
    kind: "int",
    unit: "days",
    description:
      "A regular customer who has been away this many days or more is lapsed.",
  },

  // ---- gst
  {
    path: "gst.compositionRatePct",
    group: "gst",
    label: "Composition scheme rate",
    kind: "decimal",
    decimals: 2,
    unit: "%",
    description:
      "The rate on turnover under the composition scheme. 1% is the usual rate for traders.",
  },

  // ---- loan
  {
    path: "loan.minMonthlyUpiPaise",
    group: "loan",
    label: "Minimum monthly UPI inflow",
    kind: "paise",
    description:
      "The least monthly UPI inflow that qualifies for a loan range.",
  },
  {
    path: "loan.maxCv",
    group: "loan",
    label: "Highest month-to-month swing",
    kind: "decimal",
    decimals: 2,
    unit: "CV",
    description:
      "The most that monthly UPI inflow may swing (coefficient of variation) and still qualify.",
  },
  {
    path: "loan.rangeMultiple",
    group: "loan",
    label: "Indicative ceiling",
    kind: "decimal",
    decimals: 2,
    unit: "times",
    description:
      "The indicative ceiling is this many times your average monthly UPI inflow.",
  },
  {
    path: "loan.lenderName",
    group: "loan",
    label: "Lender name",
    kind: "text",
    description: "The lender named on the loan estimate.",
  },

  // ---- recommendations
  {
    path: "recommendations.pinDueDays",
    group: "recommendations",
    label: "Pin supplier bills due within",
    kind: "int",
    unit: "days",
    description:
      "Vendor bills due within this many days are pinned to the top.",
  },
  {
    path: "recommendations.priceHikePct",
    group: "recommendations",
    label: "Flag a supplier price rise of",
    kind: "decimal",
    decimals: 1,
    unit: "%",
    description: "A supplier price rise at or above this is flagged.",
  },
  {
    path: "recommendations.vendorSwitchPct",
    group: "recommendations",
    label: "Suggest a supplier switch at",
    kind: "decimal",
    decimals: 1,
    unit: "%",
    description:
      "Suggested when another supplier is cheaper by at least this much.",
  },
  {
    path: "recommendations.lowMarginPct",
    group: "recommendations",
    label: "Low margin below",
    kind: "decimal",
    decimals: 1,
    unit: "%",
    description: "Items whose margin on price is below this are flagged.",
  },
  {
    path: "recommendations.cashShareMax",
    group: "recommendations",
    label: "Suggest more UPI above a cash share of",
    kind: "fraction",
    decimals: 1,
    unit: "%",
    description:
      "More UPI is suggested when cash is more than this share of sales.",
  },
  {
    path: "recommendations.deadStockRecovery",
    group: "recommendations",
    label: "Dead stock recovery",
    kind: "fraction",
    decimals: 1,
    unit: "%",
    description:
      "Share of its cost you expect back when dead stock is cleared.",
  },
  {
    path: "recommendations.overstockCarry",
    group: "recommendations",
    label: "Cost of carrying overstock",
    kind: "fraction",
    decimals: 1,
    unit: "%",
    description:
      "Share of the value of excess stock counted as the cost of holding it.",
  },
  {
    path: "recommendations.overstockTargetDays",
    group: "recommendations",
    label: "Target cover when judging overstock",
    kind: "int",
    unit: "days",
    description: "Stock beyond this many days of cover counts as excess.",
  },
  {
    path: "recommendations.maxItems",
    group: "recommendations",
    label: "Items in a list",
    kind: "int",
    unit: "items",
    description: "How many recommendations a list returns by default.",
  },

  // ---- bills and payments
  {
    path: "ingest.billTolerancePct",
    group: "ingest",
    label: "Supplier bill tolerance",
    kind: "decimal",
    decimals: 1,
    unit: "%",
    description:
      "A bill is flagged when its lines add up to more than this far from the printed total.",
  },
  {
    path: "ingest.billMinMatchPct",
    group: "ingest",
    label: "Bill lines that must match",
    kind: "decimal",
    decimals: 0,
    unit: "%",
    description:
      "A scanned bill is called a poor read when fewer than this share of its lines match your items. You still decide whether to accept.",
  },
  {
    path: "ingest.matchMaxScore",
    group: "ingest",
    label: "Item name matching",
    kind: "decimal",
    decimals: 2,
    unit: "score",
    description:
      "Lower is stricter when matching a name on a bill to your items.",
  },
  {
    path: "ingest.basketTolerancePct",
    group: "ingest",
    label: "Soundbox basket tolerance",
    kind: "decimal",
    decimals: 1,
    unit: "%",
    description:
      "A payment matches a heard basket when the item prices add up to within this much of the amount.",
  },
  {
    path: "ingest.basketHoldMinutes",
    group: "ingest",
    label: "Basket waits for its payment",
    kind: "int",
    unit: "minutes",
    description: "How long a heard basket waits for its payment.",
  },
  {
    path: "ingest.paymentMatchWindowMin",
    group: "ingest",
    label: "Payment screenshot time window",
    kind: "int",
    unit: "minutes",
    description:
      "How far from the stated time a Paytm transaction may be and still count as the match.",
  },

  // ---- alerts
  {
    path: "alerts.khataRed",
    group: "alerts",
    label: "Red khata customers",
    kind: "switch",
    switchLabel: "Send alerts",
    description: "Proactive messages about khata customers in the red band.",
  },
  {
    path: "alerts.sendFromHour",
    group: "alerts",
    label: "Send messages from",
    kind: "hour",
    description:
      "No proactive messages before this hour, India time. Must be earlier than the hour below.",
  },
  {
    path: "alerts.sendUntilHour",
    group: "alerts",
    label: "Send messages until",
    kind: "hour",
    description: "No proactive messages from this hour on, India time.",
  },
  {
    path: "calls.enabled",
    group: "calls",
    label: "Reminder calls",
    kind: "switch",
    switchLabel: "Call overdue customers",
    description:
      "Call Saathi phones customers whose udhaar is overdue. Manage it on the Call Saathi page.",
  },
  {
    path: "calls.minOverdueDays",
    group: "calls",
    label: "Call when overdue by",
    kind: "int",
    unit: "days",
    description: "Start calling once the oldest unpaid credit is this old.",
  },
  {
    path: "calls.minOutstandingPaise",
    group: "calls",
    label: "Smallest balance to call about",
    kind: "paise",
    description: "Customers owing less than this are not called.",
  },
  {
    path: "calls.maxAttempts",
    group: "calls",
    label: "Most calls per customer",
    kind: "int",
    unit: "calls",
    description: "Stop after this many calls.",
  },
  {
    path: "calls.retryGapDays",
    group: "calls",
    label: "Call again after",
    kind: "int",
    unit: "days",
    description: "1 = daily, 2 = alternate days, 7 = weekly.",
  },
  {
    path: "calls.fromHour",
    group: "calls",
    label: "Call from",
    kind: "hour",
    description: "No calls before this hour, India time.",
  },
  {
    path: "calls.untilHour",
    group: "calls",
    label: "Call until",
    kind: "hour",
    description: "No calls from this hour on, India time.",
  },
  {
    path: "calls.maxCallsPerRun",
    group: "calls",
    label: "Most calls per run",
    kind: "int",
    unit: "calls",
    description: "Safety cap each time Call Saathi runs.",
  },
  {
    path: "alerts.cooldownDays",
    group: "alerts",
    label: "Wait before repeating an alert",
    kind: "int",
    unit: "days",
    description: "Fewest days between two alerts of the same kind.",
  },

  // ---- festivals and language
  {
    path: "festivals",
    group: "festivals",
    label: "Your festivals",
    kind: "festivals",
    description:
      "Added to the built-in calendar. Each festival lifts the item categories you list.",
  },
  {
    path: "language",
    group: "language",
    label: "Language",
    kind: "select",
    optionLabels: { hinglish: "Hinglish", hindi: "Hindi", english: "English" },
    description: "The language Vyavahāra writes messages and replies in.",
  },
];

const BY_PATH = new Map(FIELDS.map((f) => [f.path, f]));
export const fieldByPath = (path: string): FieldDef | undefined =>
  BY_PATH.get(path);

/* ---------------- tree helpers ---------------- */

export type Tree = Record<string, unknown>;

function isTree(x: unknown): x is Tree {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function getAt(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (!isTree(cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/** Immutable set. Creates objects along the way. */
export function setAt(obj: Tree, path: string, value: unknown): Tree {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) return { ...obj, [head]: value };
  const child = isTree(obj[head]) ? obj[head] : {};
  return { ...obj, [head]: setAt(child, rest.join("."), value) };
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (isTree(a) && isTree(b)) {
    const ka = Object.keys(a);
    return (
      ka.length === Object.keys(b).length &&
      ka.every((k) => sameValue(a[k], b[k]))
    );
  }
  return false;
}

/** Every leaf path in a settings object; arrays and null are leaves. */
export function flattenPaths(obj: unknown, prefix = ""): string[] {
  if (!isTree(obj)) return prefix ? [prefix] : [];
  return Object.entries(obj).flatMap(([k, v]) =>
    flattenPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Dev-time guard: keys the API defines that this screen has no field for. */
export function findUnmapped(defaults: unknown): string[] {
  return flattenPaths(defaults).filter((p) => !BY_PATH.has(p));
}

/** Dev-time guard, other direction: fields here whose key no longer exists in the defaults. */
export function findStale(defaults: unknown): string[] {
  const live = new Set(flattenPaths(defaults));
  return FIELDS.filter((f) => !live.has(f.path)).map((f) => f.path);
}

/* ---------------- bounds, read from the zod schema ---------------- */

export interface Bounds {
  min?: number;
  max?: number;
  int?: boolean;
  minLength?: number;
  maxLength?: number;
  /** array length ceiling */
  maxItems?: number;
  options?: string[];
}

function peel(t: z.ZodType): z.ZodType {
  let cur: z.ZodType = t;
  while (
    cur instanceof z.ZodDefault ||
    cur instanceof z.ZodPrefault ||
    cur instanceof z.ZodNullable ||
    cur instanceof z.ZodOptional
  ) {
    cur = cur.def.innerType as z.ZodType;
  }
  return cur;
}

const SAFE = Number.MAX_SAFE_INTEGER;
const cache = new Map<string, Bounds>();

/**
 * Bounds for a settings path straight from `settingsSchema`. Use `*` for an array element, e.g. `cash.recurring.*.dayOfMonth`.
 */
export function boundsFor(path: string): Bounds {
  const hit = cache.get(path);
  if (hit) return hit;
  let node: z.ZodType = settingsSchema;
  for (const seg of path.split(".")) {
    node = peel(node);
    if (seg === "*" && node instanceof z.ZodArray)
      node = node.element as z.ZodType;
    else if (node instanceof z.ZodObject)
      node = (node.shape as Record<string, z.ZodType>)[seg];
    else return {};
    if (!node) return {};
  }
  node = peel(node);
  const out: Bounds = {};
  if (node instanceof z.ZodNumber) {
    if (node.minValue !== null && Math.abs(node.minValue) < SAFE)
      out.min = node.minValue;
    if (node.maxValue !== null && Math.abs(node.maxValue) < SAFE)
      out.max = node.maxValue;
    out.int = node.isInt;
  } else if (node instanceof z.ZodString) {
    if (node.minLength !== null) out.minLength = node.minLength;
    if (node.maxLength !== null) out.maxLength = node.maxLength;
  } else if (node instanceof z.ZodArray) {
    for (const c of node.def.checks ?? []) {
      const d = c._zod.def as { check: string; maximum?: number };
      if (d.check === "max_length" && typeof d.maximum === "number")
        out.maxItems = d.maximum;
    }
  } else if (node instanceof z.ZodEnum) {
    out.options = [...node.options].map(String);
  }
  cache.set(path, out);
  return out;
}
