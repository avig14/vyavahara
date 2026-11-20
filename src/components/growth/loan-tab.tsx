"use client";

import { BarSeries, compactRupees } from "@/components/charts";
import { Badge, EmptyState, Stat, Stats } from "@/components/ui";
import { num, rupees } from "@/lib/format";
import { engineText } from "@/lib/ui/api-text";
import { useL } from "@/lib/ui/lang";
import type { GrowthResponse } from "./types";

export function LoanTab({ loan }: { loan: GrowthResponse["loan"] }) {
  const l = useL();
  if (loan.monthlyUpiPaise.length === 0) {
    return (
      <EmptyState
        title={l(
          "Not enough UPI history",
          "UPI का रिकॉर्ड काफ़ी नहीं",
          "UPI ka record kaafi nahi",
        )}
        description={l(
          "The loan check looks at your monthly UPI receipts. It shows up once there are some.",
          "लोन की जाँच आपकी मासिक UPI आमद देखती है। कुछ आमद होने पर यह दिखेगी।",
          "Loan ki jaanch aapki mahine ki UPI aamad dekhti hai. Kuch aamad hone par yeh dikhegi.",
        )}
      />
    );
  }
  const bars = loan.monthlyUpiPaise.map((v, i, a) => ({
    label:
      i === a.length - 1
        ? l("Latest 30 days", "पिछले 30 दिन", "Pichhle 30 din")
        : l(
            `${a.length - 1 - i} blocks back`,
            `${a.length - 1 - i} ब्लॉक पीछे`,
            `${a.length - 1 - i} block peeche`,
          ),
    value: v,
    highlight: i === a.length - 1,
  }));
  const growth = loan.growth * 100;

  return (
    <div>
      <section
        className="gr-sec"
        aria-label={l("Eligibility", "पात्रता", "Eligibility")}
      >
        <div className="gr-verdict">
          <h2>
            {loan.eligible
              ? l(
                  "You look eligible",
                  "आप पात्र दिखते हैं",
                  "Aap eligible dikhte hain",
                )
              : l(
                  "Not eligible yet",
                  "अभी पात्र नहीं",
                  "Abhi eligible nahi",
                )}{" "}
            <Badge tone={loan.eligible ? "success" : "warn"}>
              {loan.eligible
                ? l("Indicative yes", "संकेत: हाँ", "Indicative haan")
                : l("Indicative no", "संकेत: नहीं", "Indicative nahi")}
            </Badge>
          </h2>
          {loan.eligible ? (
            <p className="gr-note">
              {l(
                "Based on your UPI receipts, a lender may offer up to the amount below. The lender decides.",
                "आपकी UPI आमद के आधार पर लेंडर नीचे की रक़म तक दे सकता है। फ़ैसला लेंडर का होता है।",
                "Aapki UPI aamad ke aadhaar par lender neeche ki raqam tak de sakta hai. Faisla lender ka hota hai.",
              )}
            </p>
          ) : (
            <p className="gr-note">
              {l(
                "Your UPI receipts do not meet the check yet. The reasons are below.",
                "आपकी UPI आमद अभी जाँच पर खरी नहीं उतरती। वजहें नीचे हैं।",
                "Aapki UPI aamad abhi jaanch par khari nahi utarti. Wajahein neeche hain.",
              )}
            </p>
          )}
        </div>
        <Stats>
          {loan.eligible ? (
            <Stat
              label={l(
                "Indicative maximum",
                "संकेतात्मक अधिकतम",
                "Indicative maximum",
              )}
              figure={rupees(loan.indicativeMaxPaise)}
              size="lg"
            />
          ) : null}
          <Stat
            label={l(
              "Average monthly UPI",
              "औसत मासिक UPI",
              "Average monthly UPI",
            )}
            figure={rupees(loan.avgMonthlyUpiPaise)}
          />
          <Stat
            label={l(
              "Share of sales on UPI",
              "UPI से बिक्री का हिस्सा",
              "UPI se bikri ka hissa",
            )}
            figure={`${num(loan.upiShare * 100)}%`}
          />
          <Stat
            label={l(
              "Change, first to latest month",
              "बदलाव, पहले से आख़िरी महीने तक",
              "Badlav, pehle se aakhri mahine tak",
            )}
            figure={`${growth > 0 ? "+" : ""}${num(growth, 1)}%`}
            tone={growth < 0 ? "danger" : "neutral"}
          />
        </Stats>
      </section>

      <section className="gr-sec" aria-label={l("Why", "क्यों", "Kyun")}>
        <div className="gr-head">
          <h2>
            {l("What the check saw", "जाँच ने क्या देखा", "Jaanch ne kya dekha")}
          </h2>
        </div>
        <ul className="gr-list">
          {loan.reasons.map((r) => (
            <li key={r}>{engineText(r, l)}</li>
          ))}
          <li>
            {loan.cv === null
              ? l(
                  "UPI inflow steadiness could not be measured.",
                  "UPI आमद की स्थिरता नापी नहीं जा सकी।",
                  "UPI aamad ki sthirta naapi nahi ja saki.",
                )
              : l(
                  `Month-to-month swing in UPI inflow is ${num(loan.cv, 2)}. Lower means steadier.`,
                  `UPI आमद का महीने-दर-महीने उतार-चढ़ाव ${num(loan.cv, 2)} है। कम का मतलब ज़्यादा स्थिर।`,
                  `UPI aamad ka mahine-dar-mahine utaar-chadhaav ${num(loan.cv, 2)} hai. Kam ka matlab zyada sthir.`,
                )}
          </li>
        </ul>
        {loan.recommendation ? (
          <p className="gr-note">{engineText(loan.recommendation, l)}</p>
        ) : null}
      </section>

      <section
        className="gr-sec"
        aria-label={l("Monthly UPI", "मासिक UPI", "Monthly UPI")}
      >
        <div className="gr-head">
          <h2>
            {l(
              `UPI receipts, last ${loan.monthlyUpiPaise.length} blocks of 30 days`,
              `UPI आमद, पिछले 30-30 दिन के ${loan.monthlyUpiPaise.length} ब्लॉक`,
              `UPI aamad, pichhle 30-30 din ke ${loan.monthlyUpiPaise.length} block`,
            )}
          </h2>
        </div>
        <BarSeries
          hint={l(
            "Each bar is one block of 30 days of UPI receipts. Taller bars mean more UPI money. A lender prefers bars that are high and similar in height. Hover or tap a bar for details.",
            "हर बार 30 दिन की UPI आमद का एक ब्लॉक है। ऊँचा बार यानी ज़्यादा UPI पैसा। लेंडर को ऊँचे और लगभग बराबर बार पसंद आते हैं। ब्योरे के लिए बार पर माउस ले जाएँ या दबाएँ।",
            "Har bar 30 din ki UPI aamad ka ek block hai. Ooncha bar matlab zyada UPI paisa. Lender ko ooncha aur lagbhag barabar bar pasand aate hain. Byore ke liye bar par mouse le jao ya dabao.",
          )}
          data={bars}
          format={rupees}
          axisFormat={compactRupees}
          summary={l(
            `UPI receipts per 30 days, oldest first: ${loan.monthlyUpiPaise.map((v) => rupees(v)).join(", ")}.`,
            `हर 30 दिन की UPI आमद, पुरानी पहले: ${loan.monthlyUpiPaise.map((v) => rupees(v)).join(", ")}।`,
            `Har 30 din ki UPI aamad, purani pehle: ${loan.monthlyUpiPaise.map((v) => rupees(v)).join(", ")}.`,
          )}
        />
      </section>

      <p className="gr-note">{engineText(loan.disclaimer, l)}</p>
    </div>
  );
}
