/**
 * Photo reader on Sarvam Vision (Document AI "Extract"). Verified against docs.sarvam.ai (Nov 2026) and live calls:
 *  - POST /doc-ai/v1/job/extract   multipart {file (jpg/png), schema (JSON string), mode}  → { job_id }
 *  - GET  /doc-ai/v1/job/{id}/status   → { status: pending|running|completed|partially_completed|failed|rejected }
 *  - GET  /doc-ai/v1/job/{id}/results  → { result: { ...fields of the schema } }
 * Schema rules from the docs: root is an object, every field has a type and a non-empty description, enum is allowed, depth ≤ 4.
 * Like the Claude reader, this only READS. Totals and matching stay in code (bill-plan.ts, reconcile.ts).
 * Sarvam takes JPG/PNG (not WebP/GIF): those are converted to PNG with sharp first.
 */
import { createHash } from "node:crypto";
import type { Bill, ImageInput, PaymentShotRaw } from "./vision";
import { SarvamError } from "./sarvam";

const BASE = "https://api.sarvam.ai/doc-ai/v1/job";

export type ImageKindName = "supplier_bill" | "payment_screenshot" | "other";

const BILL_FIELDS = {
  vendor_name: { type: "string", description: "Supplier or shop name printed at the top of the bill" },
  invoice_no: { type: "string", description: "Invoice or bill number" },
  invoice_date: { type: "string", description: "Invoice date exactly as printed" },
  items: {
    type: "array",
    description: "Every product line on the bill, in order",
    items: {
      type: "object",
      properties: {
        name: { type: "string", description: "Item name exactly as printed" },
        qty: { type: "number", description: "Quantity" },
        unit_price: { type: "number", description: "Rate per unit in INR" },
        line_total: { type: "number", description: "Line amount in INR" },
      },
    },
  },
  total: { type: "number", description: "Net payable / bill total in INR" },
};

const BILL_SCHEMA = { type: "object", properties: BILL_FIELDS };

/** One read that also says what the photo is, so a chat photo costs one scan, not three. */
const DOC_SCHEMA = {
  type: "object",
  properties: {
    document_type: {
      type: "string",
      enum: ["supplier_bill", "payment_screenshot", "other"],
      description: "supplier_bill = a vendor/supplier invoice or bill with product lines; payment_screenshot = a UPI or payment-app success screen; other = anything else",
    },
    ...BILL_FIELDS,
    pay_amount: { type: "number", description: "Amount paid in INR, only on a payment screenshot" },
    pay_utr: { type: "string", description: "UTR / UPI transaction reference number, only on a payment screenshot" },
    pay_datetime: { type: "string", description: "Date and time of the payment exactly as shown, only on a payment screenshot" },
    pay_payee: { type: "string", description: "Name of the person or shop paid, only on a payment screenshot" },
    pay_app: { type: "string", description: "Payment app name such as Paytm, PhonePe, Google Pay, only on a payment screenshot" },
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "20-11-2026", "20/11/26", "2026-11-20" → "2026-11-20". Anything else → null (the plan then shows "Not found"). */
export function isoDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s))) [d, mo, y] = [+m[1], +m[2], m[3].length === 2 ? 2000 + +m[3] : +m[3]];
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "20 Nov 2026, 3:45 PM" / "20/11/2026 15:45" / "2026-11-20T15:45:00+05:30" → ISO with +05:30. Anything else → null (the match then uses amount/UTR only). */
export function isoDateTimeIST(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !Number.isNaN(new Date(s).getTime())) return s;
  let y: number, mo: number, d: number;
  let m = /(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3})[a-z]*[\s,-]+(\d{4})/.exec(s);
  if (m && MONTHS.includes(m[2].toLowerCase())) [d, mo, y] = [+m[1], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[3]];
  else if ((m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else return null;
  const t = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/.exec(s.slice(m.index + m[0].length));
  if (!t) return null;
  let h = +t[1];
  const mi = +t[2];
  if (t[3]) {
    const pm = t[3].toLowerCase() === "pm";
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (pm ? 12 : 0);
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(mi)}:00+05:30`;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Map Sarvam's `result` object onto our Bill. Unreadable fields become null; an item with no name or qty is dropped. */
export function billFromSarvam(result: unknown): Bill | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const items = (Array.isArray(r.items) ? r.items : []).flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const o = x as Record<string, unknown>;
    const name = str(o.name);
    const qty = num(o.qty);
    return name && qty !== null ? [{ name, qty, unit: null, unit_price: num(o.unit_price), line_total: num(o.line_total) }] : [];
  });
  return { vendor_name: str(r.vendor_name), invoice_no: str(r.invoice_no), invoice_date: isoDate(r.invoice_date), items, total: num(r.total) };
}

/** The payment-screenshot fields of a combined read. null when neither an amount nor a UTR was read. */
export function shotFromSarvam(result: unknown): PaymentShotRaw | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const amount = num(r.pay_amount);
  const utr = str(r.pay_utr);
  if (amount === null && !utr) return null;
  return { amount, utr, datetime: isoDateTimeIST(r.pay_datetime), payee_name: str(r.pay_payee), app: str(r.pay_app) };
}

export interface ImageRead {
  kind: ImageKindName;
  bill: Bill | null;
  shot: PaymentShotRaw | null;
}

/** Turn a combined read into a verdict. The model's label is trusted only when the fields behind it are really there. */
export function imageReadFromSarvam(result: unknown): ImageRead {
  const r = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const label = str(r.document_type);
  const bill = billFromSarvam(result);
  const shot = shotFromSarvam(result);
  const billish = Boolean(bill && (bill.items.length > 0 || bill.total !== null));
  let kind: ImageKindName = label === "supplier_bill" || label === "payment_screenshot" ? label : "other";
  if (kind === "supplier_bill" && !billish) kind = "other";
  if (kind === "payment_screenshot" && !shot) kind = "other";
  return { kind, bill, shot };
}

export interface SarvamOcrOpts {
  /** poll gap in ms (tests set 0) */
  pollMs?: number;
  /** give up after this many ms; the route has maxDuration 60 s */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Sarvam reads JPG/PNG only. WebP and GIF (chat stickers, some phones) are converted; if that is impossible the owner is asked to resend. */
async function supported(i: ImageInput): Promise<{ bytes: Buffer; mime: "image/jpeg" | "image/png"; ext: string }> {
  const bytes = Buffer.from(i.base64, "base64");
  if (i.mime === "image/jpeg") return { bytes, mime: i.mime, ext: "jpg" };
  if (i.mime === "image/png") return { bytes, mime: i.mime, ext: "png" };
  try {
    const sharp = (await import("sharp")).default;
    return { bytes: await sharp(bytes).png().toBuffer(), mime: "image/png", ext: "png" };
  } catch {
    throw new SarvamError(`Cannot read ${i.mime} photos here`);
  }
}

/** Run one Extract job with `schema`. Returns the `result` object, or null when Sarvam could not read the photo. */
async function runExtract(i: ImageInput, schema: object, opts: SarvamOcrOpts): Promise<unknown | null> {
  const k = process.env.SARVAM_API_KEY;
  if (!k) throw new SarvamError("SARVAM_API_KEY is not set");
  const f = opts.fetchImpl ?? fetch;
  const headers = { "api-subscription-key": k };
  const pollMs = opts.pollMs ?? 1500;
  const deadline = Date.now() + (opts.timeoutMs ?? 40_000);

  const file = await supported(i);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(file.bytes)], { type: file.mime }), `photo.${file.ext}`);
  form.append("schema", JSON.stringify(schema));
  form.append("mode", "basic");

  const created = await f(`${BASE}/extract`, { method: "POST", headers, body: form, signal: AbortSignal.timeout(25_000) });
  if (!created.ok) throw new SarvamError(`Photo read failed to start (${created.status})`, created.status);
  const jobId = ((await created.json()) as { job_id?: string }).job_id;
  if (!jobId) throw new SarvamError("Photo read: no job id");

  for (;;) {
    if (pollMs) await sleep(pollMs);
    const st = await f(`${BASE}/${encodeURIComponent(jobId)}/status`, { headers, signal: AbortSignal.timeout(15_000) });
    if (!st.ok) throw new SarvamError(`Photo read status failed (${st.status})`, st.status);
    const status = String(((await st.json()) as { status?: string }).status ?? "").toLowerCase();
    if (status === "completed" || status === "partially_completed") break;
    if (status === "failed" || status === "rejected") return null;
    if (Date.now() > deadline) throw new SarvamError("Photo read timed out");
  }

  const res = await f(`${BASE}/${encodeURIComponent(jobId)}/results`, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new SarvamError(`Photo read result failed (${res.status})`, res.status);
  return ((await res.json()) as { result?: unknown }).result ?? null;
}

/* A chat photo is read once, then asked about three times (what is it? / bill / payment). Remember the read for a few minutes. */
const TTL_MS = 5 * 60_000;
const MAX_KEPT = 16;
const kept = new Map<string, { at: number; read: Promise<ImageRead> }>();
const keyOf = (i: ImageInput) => createHash("sha256").update(i.mime).update(i.base64).digest("hex");
export const _clearReadCache = () => kept.clear();

function recall(i: ImageInput): Promise<ImageRead> | null {
  const hit = kept.get(keyOf(i));
  return hit && Date.now() - hit.at < TTL_MS ? hit.read : null;
}

/** Read a photo once: what it is, plus the bill or payment fields. Same photo within 5 minutes reuses the read. Throws SarvamError on a service problem. */
export function readImageSarvam(i: ImageInput, opts: SarvamOcrOpts = {}): Promise<ImageRead> {
  const key = keyOf(i);
  const hit = recall(i);
  if (hit) return hit;
  const read = runExtract(i, DOC_SCHEMA, opts).then((r) => imageReadFromSarvam(r));
  kept.set(key, { at: Date.now(), read });
  if (kept.size > MAX_KEPT) kept.delete(kept.keys().next().value as string);
  read.catch(() => kept.delete(key)); // never remember a failure
  return read;
}

/** Read a supplier-bill photo. null = Sarvam could not read it (the owner is asked to retake). Throws SarvamError on a service problem. */
export async function extractBillSarvam(i: ImageInput, opts: SarvamOcrOpts = {}): Promise<Bill | null> {
  const earlier = recall(i);
  if (earlier) {
    try {
      return (await earlier).bill;
    } catch {
      /* that read failed: read again below */
    }
  }
  return billFromSarvam(await runExtract(i, BILL_SCHEMA, opts));
}
