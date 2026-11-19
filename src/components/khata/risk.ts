import type { RiskBand } from "@/lib/analytics/khata-risk";
import type { BadgeTone } from "@/components/ui";

/** The words say the risk; the tone only backs them up. */
export const RISK: Record<RiskBand, { label: string; tone: BadgeTone; rank: number }> = {
  red: { label: "High risk", tone: "danger", rank: 3 },
  amber: { label: "Medium risk", tone: "warn", rank: 2 },
  green: { label: "Low risk", tone: "success", rank: 1 },
};
