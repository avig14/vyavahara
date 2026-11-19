/**
 * Supplier bill → a reviewable plan. Pure: the model only READ the photo, every check and number here is code.
 * The owner always sees this review and accepts or rejects before any stock or payable changes.
 * `payload` is null when the bill cannot be saved as read (verdict "retake"): then the only sensible answer is a new photo.
 */
import Fuse from "fuse.js";
import type { PendingPayload } from "../agent/actions";
import type { Snapshot, Vendor } from "../domain";
import { addDays, istDayKey, istDayStart } from "../time";
import { buildMatcher } from "./match";
import { validateBill, type Bill } from "./vision";

export type BillVerdict = "good" | "check" | "retake";

export interface BillLineReview {
  printedName: string;
  qty: number;
  unit: string | null;
  unitCostPaise: number | null;
  lineTotalPaise: number | null;
  /** null = not in the owner's catalog; this line will NOT add stock */
  product: { id: string; name: string; unit: string } | null;
}

export interface BillReview {
  verdict: BillVerdict;
  vendor: { id: string | null; name: string | null; printedName: string | null };
  invoiceNo: string | null;
  invoiceDate: string;
  dueDate: string | null;
  /** what will be added to payables (printed total, else the lines' sum) */
  totalPaise: number | null;
  lines: BillLineReview[];
  matchedCount: number;
  unmatchedCount: number;
  lineSumPaise: number;
  /** % gap between lines' sum and the printed total; null when either is unknown */
  diffPct: number | null;
  /** plain reasons the owner should look again, Hinglish */
  problems: string[];
  duplicate: boolean;
}

export type StockInPayload = Extract<PendingPayload, { kind: "stock_in" }>;
export interface BillPlan {
  review: BillReview;
  payload: StockInPayload | null;
}

export interface PlanBillOpts {
  /** owner picked the supplier up front: wins over the name read from the bill */
  vendorId?: string | null;
  now?: Date;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(pvt|ltd|private|limited|and|co|company)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function matchVendor(vendors: Vendor[], printed: string | null, maxScore: number): Vendor | null {
  const q = printed ? norm(printed) : "";
  if (!q) return null;
  const docs = vendors.map((v) => ({ v, name: norm(v.name) }));
  const exact = docs.find((d) => d.name === q);
  if (exact) return exact.v;
  const [best] = new Fuse(docs, { keys: ["name"], includeScore: true, ignoreLocation: true, threshold: maxScore }).search(q, { limit: 1 });
  return best ? best.item.v : null;
}

const paise = (rupees: number) => Math.round(rupees * 100);
const validDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(istDayStart(s).getTime());

export function planBill(bill: Bill, snap: Snapshot, opts: PlanBillOpts = {}): BillPlan {
  const now = opts.now ?? snap.now;
  const cfg = snap.settings.ingest;
  const problems: string[] = [];
  const check = validateBill(bill, cfg.billTolerancePct);

  /* supplier */
  const picked = opts.vendorId ? snap.vendors.find((v) => v.id === opts.vendorId) ?? null : null;
  const vendor = picked ?? matchVendor(snap.vendors, bill.vendor_name, cfg.matchMaxScore);
  if (!vendor) problems.push(bill.vendor_name ? `Supplier "${bill.vendor_name}" aapki list mein nahi mila` : "Bill par supplier ka naam padh nahi paya");

  /* lines */
  const matcher = buildMatcher(snap.products, cfg.matchMaxScore);
  const lines: BillLineReview[] = bill.items.map((it) => {
    const hit = matcher.match(it.name);
    const lineTotal = it.line_total ?? (it.unit_price !== null ? it.qty * it.unit_price : null);
    const unitCost = it.unit_price ?? (it.line_total !== null && it.qty > 0 ? it.line_total / it.qty : null);
    return {
      printedName: it.name,
      qty: it.qty,
      unit: it.unit,
      unitCostPaise: unitCost === null ? null : paise(unitCost),
      lineTotalPaise: lineTotal === null ? null : paise(lineTotal),
      product: hit ? { id: hit.product.id, name: hit.product.name, unit: hit.product.unit } : null,
    };
  });
  const matched = lines.filter((l) => l.product);
  const unmatched = lines.length - matched.length;
  const matchPct = lines.length ? (matched.length / lines.length) * 100 : 0;
  const lineSumPaise = paise(check.lineSumRupees);

  for (const p of check.problems) if (!/^Bill ka total/.test(p)) problems.push(p);
  if (bill.total === null) problems.push("Bill ka total padh nahi paya, items ka jod le rahe hain");
  if (unmatched > 0) problems.push(`${lines.length} mein se ${matched.length} item aapke catalog se mile. Baaki ${unmatched} ka stock add nahi hoga`);
  if (lines.length && matchPct < cfg.billMinMatchPct) problems.push("Photo shayad poori nahi aayi. Dobara lena behtar hai");

  /* dates */
  const today = istDayKey(now);
  let invoiceDate = today;
  if (validDay(bill.invoice_date) && bill.invoice_date <= today) invoiceDate = bill.invoice_date;
  else if (bill.invoice_date) problems.push("Bill ki date galat lagi, aaj ki date li");
  else problems.push("Bill par date nahi mili, aaj ki date li");
  const dueDate = vendor ? istDayKey(addDays(istDayStart(invoiceDate), vendor.paymentTermsDays)) : null;

  /* the same bill twice (a retake after accepting would double the stock) */
  const invoiceNo = bill.invoice_no?.trim() || null;
  const duplicate = !!(vendor && invoiceNo && snap.purchases.some((p) => p.vendorId === vendor.id && p.invoiceNo?.toLowerCase() === invoiceNo.toLowerCase()));
  if (duplicate) problems.unshift(`Bill #${invoiceNo} pehle se add ho chuka hai`);

  const totalPaise = bill.total !== null ? paise(bill.total) : lineSumPaise > 0 ? lineSumPaise : null;

  /* stock-in lines: matched, with a quantity and a rate; same item twice → one line */
  const merged = new Map<string, { productId: string; name: string; qty: number; costTotal: number }>();
  for (const l of matched) {
    if (!(l.qty > 0) || l.unitCostPaise === null) continue;
    const cur = merged.get(l.product!.id);
    if (cur) {
      cur.qty += l.qty;
      cur.costTotal += l.unitCostPaise * l.qty;
    } else merged.set(l.product!.id, { productId: l.product!.id, name: l.product!.name, qty: l.qty, costTotal: l.unitCostPaise * l.qty });
  }
  const items = [...merged.values()].map((m) => ({ productId: m.productId, name: m.name, qty: m.qty, unitCostPaise: Math.round(m.costTotal / m.qty) }));

  const blocked = !vendor || duplicate || items.length === 0 || totalPaise === null || totalPaise <= 0;
  if (!blocked && matched.length > items.length && lines.length === matched.length) problems.push("Kuch items ka rate ya quantity padh nahi paya");

  if (blocked && !problems.length) problems.push("Bill poora padha nahi gaya");
  const verdict: BillVerdict = blocked ? "retake" : problems.length ? "check" : "good";
  const review: BillReview = {
    verdict,
    vendor: { id: vendor?.id ?? null, name: vendor?.name ?? null, printedName: bill.vendor_name },
    invoiceNo,
    invoiceDate,
    dueDate,
    totalPaise,
    lines,
    matchedCount: matched.length,
    unmatchedCount: unmatched,
    lineSumPaise,
    diffPct: check.diffPct,
    problems: [...new Set(problems)],
    duplicate,
  };
  if (blocked || !vendor || dueDate === null || totalPaise === null) return { review, payload: null };
  return {
    review,
    payload: { kind: "stock_in", vendorId: vendor.id, vendorName: vendor.name, invoiceNo, invoiceDate, dueDate, totalPaise, items },
  };
}
