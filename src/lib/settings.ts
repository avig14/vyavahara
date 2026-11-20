/**
 * Per-merchant business settings. Every threshold the analytics, reports and alerts use lives here,
 * so a merchant can tune Vyavahāra to their own shop from the dashboard (GET/PUT /api/settings).
 * Stored as jsonb on `merchants.settings`; missing keys fall back to defaults, so old rows keep working.
 * Money fields are integer paise.
 */
import { z } from "zod";

const int = (min: number, max: number, def: number) => z.number().int().min(min).max(max).default(def);
const num = (min: number, max: number, def: number) => z.number().min(min).max(max).default(def);

export const settingsSchema = z.object({
  inventory: z
    .object({
      /** z-score for safety stock: 1.28=90%, 1.65=95%, 2.05=98% service level */
      serviceLevelZ: num(0.5, 3, 1.65),
      /** extra days of cover a suggested order should buy on top of lead time */
      reviewBufferDays: int(0, 30, 7),
      /** flag overstock when cover exceeds this many days */
      overstockCoverDays: int(14, 365, 45),
      /** flag dead stock when nothing sold in this many days */
      deadStockDays: int(14, 180, 28),
      /** forecast horizon shown on the dashboard */
      horizonDays: int(7, 28, 14),
    })
    .prefault({}),

  khata: z
    .object({
      /** risk-score weights (PRD B8.4) — need not sum to 100 */
      weights: z
        .object({
          oldest: num(0, 100, 35),
          repay: num(0, 100, 25),
          utilization: num(0, 100, 15),
          lastPayment: num(0, 100, 15),
          growing: num(0, 100, 10),
        })
        .prefault({}),
      /** days of unpaid age at which the "oldest" component maxes out */
      oldestFullDays: int(15, 180, 60),
      lastPaymentFullDays: int(15, 180, 45),
      /** score ≤ greenMax → 🟢, ≤ amberMax → 🟡, else 🔴 */
      greenMax: int(5, 60, 30),
      amberMax: int(20, 95, 60),
      /** share of outstanding expected back, by band */
      recovery: z
        .object({ green: num(0, 1, 0.9), amber: num(0, 1, 0.6), red: num(0, 1, 0.3) })
        .prefault({}),
      /** suggested limit for green customers = this × their monthly purchases */
      limitMultiplier: num(0.5, 5, 1.5),
      /** limit given to a brand-new khata customer, paise */
      defaultLimitPaise: int(0, 100_000_00, 2000_00),
    })
    .prefault({}),

  cash: z
    .object({
      /** cash in hand + bank at start of projection, paise (owner-entered; 0 = unknown) */
      openingBalancePaise: int(0, 100_000_000_00, 0),
      /** keep at least this much after paying vendors, paise */
      minBufferPaise: int(0, 100_000_000_00, 0),
      /** days over which outstanding khata is assumed to come back */
      collectionDays: int(7, 60, 14),
      /** null = learn rent/salary/electricity from expense history; else the owner's own list */
      recurring: z
        .array(
          z.object({
            label: z.string().min(1).max(40),
            amountPaise: z.number().int().min(0),
            dayOfMonth: z.number().int().min(1).max(31),
          }),
        )
        .nullable()
        .default(null),
    })
    .prefault({}),

  anomalies: z
    .object({
      zThreshold: num(1, 4, 2),
      /** a drop this large vs the usual is also flagged when z ≤ −zThreshold/2 (partial-day sales are noisy) */
      salesDipPct: num(0.1, 0.9, 0.25),
      refundMultiple: num(1, 10, 2),
      /** item flagged when it sells below this share of forecast for 3 days */
      itemDropShare: num(0.1, 0.9, 0.4),
    })
    .prefault({}),

  customers: z
    .object({
      /** Regular = at least this many visit-days within regularWindowDays */
      regularVisits: int(2, 20, 4),
      regularWindowDays: int(7, 90, 30),
      /** New = first seen this many days ago or less */
      newDays: int(3, 60, 14),
      /** Lapsed = was regular, absent this many days or more */
      lapsedDays: int(7, 90, 14),
    })
    .prefault({}),

  gst: z
    .object({
      /** composition scheme turnover rate, percent (1% for traders) */
      compositionRatePct: num(0, 12, 1),
    })
    .prefault({}),

  loan: z
    .object({
      minMonthlyUpiPaise: int(0, 100_000_000_00, 60_000_00),
      maxCv: num(0.05, 2, 0.4),
      /** indicative ceiling = this × average monthly UPI inflow */
      rangeMultiple: num(0.25, 6, 1),
      lenderName: z.string().min(1).max(60).default("Partner lender (placeholder)"),
    })
    .prefault({}),

  recommendations: z
    .object({
      /** vendor bills due within this many days are pinned to the top */
      pinDueDays: int(0, 14, 2),
      /** flag a supplier price rise at or above this percent */
      priceHikePct: num(1, 50, 5),
      /** suggest a vendor switch when another supplier is cheaper by at least this percent */
      vendorSwitchPct: num(1, 50, 3),
      /** flag items whose margin on price is below this percent */
      lowMarginPct: num(0, 50, 8),
      /** suggest more UPI when cash share is above this fraction */
      cashShareMax: num(0.05, 1, 0.4),
      /** dead stock: expected recovery as a share of cost when cleared */
      deadStockRecovery: num(0.1, 1, 0.5),
      /** overstock: share of excess stock value counted as cost of carrying it */
      overstockCarry: num(0.05, 1, 0.3),
      /** target days of cover when judging overstock excess */
      overstockTargetDays: int(7, 90, 30),
      /** how many recommendations a list returns by default */
      maxItems: int(3, 30, 10),
    })
    .prefault({}),

  ingest: z
    .object({
      /** supplier bill: flag when sum of lines differs from printed total by more than this percent */
      billTolerancePct: num(0, 20, 2),
      /** supplier bill: below this share of lines matched to your items, the bill is called a poor read (owner can still accept) */
      billMinMatchPct: num(0, 100, 70),
      /** fuzzy item match: lower = stricter (Fuse score ceiling) */
      matchMaxScore: num(0.05, 0.8, 0.35),
      /** soundbox: payment matches a basket when item prices sum within this percent of the amount */
      basketTolerancePct: num(0, 25, 5),
      /** soundbox: how long a heard basket waits for its payment */
      basketHoldMinutes: int(1, 30, 3),
      /** payment screenshot: how far from the stated time a Paytm transaction may be to count as a match */
      paymentMatchWindowMin: int(1, 240, 30),
    })
    .prefault({}),

  alerts: z
    .object({
      khataRed: z.boolean().default(true),
      /** no proactive messages outside [quietUntilHour … quietFromHour) IST */
      sendFromHour: int(0, 23, 9),
      sendUntilHour: int(1, 24, 21),
      cooldownDays: int(1, 60, 7),
    })
    .prefault({}),

  /** Call Saathi: automatic reminder calls to customers with long-overdue udhaar */
  calls: z
    .object({
      /** master switch; off until the owner turns it on */
      enabled: z.boolean().default(false),
      /** start calling once the oldest unpaid credit is at least this many days old */
      minOverdueDays: int(7, 365, 30),
      /** ignore balances below this, paise */
      minOutstandingPaise: int(0, 100_000_00, 500_00),
      /** give up after this many calls to one customer */
      maxAttempts: int(1, 10, 3),
      /** wait at least this many days between calls to the same customer */
      retryGapDays: int(1, 30, 3),
      /** calls only inside [fromHour, untilHour) IST. The merchant decides. */
      fromHour: int(0, 23, 10),
      untilHour: int(1, 24, 19),
      /** safety cap per run */
      maxCallsPerRun: int(1, 100, 10),
    })
    .prefault({}),

  /** extra festivals the merchant cares about, merged with the built-in calendar */
  festivals: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        categories: z.array(z.string().min(1)).max(10),
      }),
    )
    .default([]),

  language: z.enum(["hinglish", "hindi", "english"]).default("hinglish"),
});

export type MerchantSettings = z.infer<typeof settingsSchema>;
/** Partial update shape accepted by the API (every key optional, deep). */
export type SettingsPatch = z.input<typeof settingsSchema>;

export const DEFAULT_SETTINGS: MerchantSettings = settingsSchema.parse({});

export function resolveSettings(raw: unknown): MerchantSettings {
  const r = settingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : DEFAULT_SETTINGS;
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function merge(a: unknown, b: unknown): unknown {
  if (!isObj(a) || !isObj(b)) return b === undefined ? a : b;
  const out: Record<string, unknown> = { ...a };
  for (const k of Object.keys(b)) out[k] = merge(a[k], b[k]);
  return out;
}

export type SettingsResult = { ok: true; settings: MerchantSettings } | { ok: false; error: string };

/** Apply a deep patch to existing settings and validate. Arrays replace, objects merge. */
export function applySettingsPatch(current: MerchantSettings, patch: unknown): SettingsResult {
  const r = settingsSchema.safeParse(merge(current, patch));
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const s = r.data;
  if (s.khata.greenMax >= s.khata.amberMax) return { ok: false, error: "khata.greenMax must be below khata.amberMax" };
  if (s.alerts.sendFromHour >= s.alerts.sendUntilHour) return { ok: false, error: "alerts.sendFromHour must be before sendUntilHour" };
  if (s.calls.fromHour >= s.calls.untilHour) return { ok: false, error: "calls.fromHour must be before calls.untilHour" };
  return { ok: true, settings: s };
}
