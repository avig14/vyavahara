/** PRD 5.3 loan eligibility check. Indicative only. Thresholds from settings.loan. Pure. */
import type { Snapshot } from "../domain";
import { mean, stdev } from "../domain";
import { dailyRevenue } from "./series";
import { rupees } from "../format";

export const LOAN_DISCLAIMER =
  "Yeh sirf indicative hai, loan lender ki approval par depend karta hai. Accept karne se pehle Key Fact Statement (KFS) dikhaya jayega.";

export interface LoanCheck {
  eligible: boolean;
  /** UPI inflow per 30-day block, oldest first */
  monthlyUpiPaise: number[];
  avgMonthlyUpiPaise: number;
  cv: number;
  /** last block vs first block, e.g. 0.08 = +8% */
  growth: number;
  upiShare: number;
  indicativeMaxPaise: number;
  lenderName: string;
  reasons: string[];
  recommendation: string | null;
  disclaimer: string;
}

export function checkLoan(snap: Snapshot): LoanCheck {
  const cfg = snap.settings.loan;
  const r = dailyRevenue(snap, 120);
  const blocks: number[] = [];
  for (let end = r.upi.length; end - 30 >= 0; end -= 30) blocks.unshift(r.upi.slice(end - 30, end).reduce((a, b) => a + b, 0));
  const avg = mean(blocks);
  const cv = avg > 0 ? stdev(blocks) / avg : Infinity;
  const growth = blocks.length > 1 && blocks[0] > 0 ? blocks[blocks.length - 1] / blocks[0] - 1 : 0;
  const total30 = r.net.slice(-30).reduce((a, b) => a + b, 0);
  const upiShare = total30 > 0 ? r.upi.slice(-30).reduce((a, b) => a + b, 0) / total30 : 0;

  const reasons: string[] = [];
  const okVolume = avg >= cfg.minMonthlyUpiPaise;
  const okSteady = cv < cfg.maxCv;
  reasons.push(
    okVolume
      ? `Average monthly UPI ${rupees(Math.round(avg))} (zaroori ${rupees(cfg.minMonthlyUpiPaise)})`
      : `Average monthly UPI ${rupees(Math.round(avg))} kam hai (zaroori ${rupees(cfg.minMonthlyUpiPaise)})`,
  );
  reasons.push(okSteady ? `UPI inflow steady hai (CV ${cv.toFixed(2)})` : `UPI inflow utar-chadhav wala hai (CV ${cv.toFixed(2)})`);
  const eligible = okVolume && okSteady;

  return {
    eligible,
    monthlyUpiPaise: blocks,
    avgMonthlyUpiPaise: Math.round(avg),
    cv,
    growth,
    upiShare,
    indicativeMaxPaise: eligible ? Math.round(avg * cfg.rangeMultiple) : 0,
    lenderName: cfg.lenderName,
    reasons,
    recommendation: upiShare < 0.7 ? "Cash sales UPI mein lo — UPI history se loan eligibility badhti hai." : null,
    disclaimer: LOAN_DISCLAIMER,
  };
}
