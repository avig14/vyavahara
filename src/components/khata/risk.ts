import type { RiskBand } from "@/lib/analytics/khata-risk";
import type { BadgeTone } from "@/components/ui";
import type { L } from "@/lib/ui/lang";

/** The words say the risk; the tone only backs them up. */
export const riskMeta = (
  l: L,
): Record<RiskBand, { label: string; tone: BadgeTone; rank: number }> => ({
  red: {
    label: l("High risk", "ज़्यादा जोखिम", "High risk"),
    tone: "danger",
    rank: 3,
  },
  amber: {
    label: l("Medium risk", "मध्यम जोखिम", "Medium risk"),
    tone: "warn",
    rank: 2,
  },
  green: {
    label: l("Low risk", "कम जोखिम", "Low risk"),
    tone: "success",
    rank: 1,
  },
});
