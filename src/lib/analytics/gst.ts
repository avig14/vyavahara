/** PRD 5.4 GST summary (estimate). Composition → rate% × turnover; regular → per-slab output tax minus input tax. Pure. */
import type { Snapshot } from "../domain";
import { byId, sum } from "../domain";
import { istDayKey, istDayStart } from "../time";

export const GST_DISCLAIMER = "Yeh sirf andaaza hai. Filing se pehle apne CA se verify karein.";

export interface GstPeriod {
  from: string; // IST day key, inclusive
  to: string; // IST day key, inclusive
  label: string;
}

/** Indian financial-year quarter containing `d` (Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar). */
export function quarterOf(d: Date): GstPeriod {
  const key = istDayKey(d);
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const qStart = [1, 4, 7, 10][Math.floor((m - 1) / 3)];
  const qEnd = qStart + 2;
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, qEnd, 0)).getUTCDate();
  const fy = m >= 4 ? y : y - 1;
  const qn = m >= 4 ? Math.floor((m - 4) / 3) + 1 : 4;
  return { from: `${y}-${pad(qStart)}-01`, to: `${y}-${pad(qEnd)}-${pad(last)}`, label: `Q${qn} FY${fy}-${String(fy + 1).slice(2)}` };
}

export interface GstSlab {
  ratePct: number;
  grossPaise: number;
  taxablePaise: number;
  outputTaxPaise: number;
  inputTaxPaise: number;
}

export interface GstSummary {
  scheme: "composition" | "regular" | "none";
  period: GstPeriod;
  turnoverPaise: number;
  compositionRatePct?: number;
  compositionTaxPaise?: number;
  slabs?: GstSlab[];
  outputTaxPaise?: number;
  inputTaxPaise?: number;
  netPayablePaise?: number;
  note: string;
  disclaimer: string;
}

const inclusiveTax = (gross: number, ratePct: number) => Math.round((gross * ratePct) / (100 + ratePct));

export function gstSummary(snap: Snapshot, period: GstPeriod = quarterOf(snap.now)): GstSummary {
  const from = istDayStart(period.from);
  const to = new Date(istDayStart(period.to).getTime() + 86_400_000 - 1);
  const inPeriod = (d: Date) => d >= from && d <= to;
  const scheme = snap.merchant.gstScheme;

  const sales = snap.transactions.filter((t) => inPeriod(t.createdAt));
  const turnover = sum(sales.map((t) => (t.kind === "refund" ? -t.amountPaise : t.amountPaise)));

  if (scheme === "none")
    return { scheme, period, turnoverPaise: turnover, note: "GST registration nahi hai, isliye tax nahi banta.", disclaimer: GST_DISCLAIMER };

  if (scheme === "composition") {
    const rate = snap.settings.gst.compositionRatePct;
    return {
      scheme,
      period,
      turnoverPaise: turnover,
      compositionRatePct: rate,
      compositionTaxPaise: Math.round((turnover * rate) / 100),
      note: `Composition: ${rate}% × quarter ki turnover (CMP-08 ke liye).`,
      disclaimer: GST_DISCLAIMER,
    };
  }

  // regular dealer
  const products = byId(snap.products);
  const slabs = new Map<number, GstSlab>();
  const slab = (r: number) => {
    const s = slabs.get(r) ?? { ratePct: r, grossPaise: 0, taxablePaise: 0, outputTaxPaise: 0, inputTaxPaise: 0 };
    slabs.set(r, s);
    return s;
  };
  for (const si of snap.saleItems) {
    if (!inPeriod(si.createdAt)) continue;
    const r = products.get(si.productId)?.gstRate ?? 0;
    const gross = si.qty * si.unitPricePaise;
    const s = slab(r);
    s.grossPaise += gross;
    const tax = inclusiveTax(gross, r);
    s.outputTaxPaise += tax;
    s.taxablePaise += gross - tax;
  }
  const purchases = new Map(snap.purchases.map((p) => [p.id, p]));
  for (const pi of snap.purchaseItems) {
    const p = purchases.get(pi.purchaseId);
    if (!p || p.invoiceDate < period.from || p.invoiceDate > period.to) continue;
    slab(pi.gstRate).inputTaxPaise += inclusiveTax(pi.qty * pi.unitCostPaise, pi.gstRate);
  }
  const list = [...slabs.values()].sort((a, b) => a.ratePct - b.ratePct);
  const output = sum(list.map((s) => s.outputTaxPaise));
  const input = sum(list.map((s) => s.inputTaxPaise));
  return {
    scheme,
    period,
    turnoverPaise: turnover,
    slabs: list,
    outputTaxPaise: output,
    inputTaxPaise: input,
    netPayablePaise: output - input,
    note: "Regular dealer: slab-wise output tax (tax-inclusive prices) minus purchase bills ka input tax.",
    disclaimer: GST_DISCLAIMER,
  };
}
