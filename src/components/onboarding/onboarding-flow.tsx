"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  buttonClass,
  CheckIcon,
  ErrorState,
  SkeletonRows,
} from "@/components/ui";
import { ApiError, postJson, toApiError, useApi } from "@/lib/ui/api";
import { useQueryState } from "@/lib/ui/url-state";
import { useL } from "@/lib/ui/lang";

const STEPS = ["1", "2", "3", "4"] as const;
type Step = (typeof STEPS)[number];

/** Shape of `POST /api/onboarding/connect-paytm`. */
interface Connected {
  connected: true;
  merchant: {
    name: string;
    ownerName: string;
    city: string | null;
    upiId: string | null;
  };
}

type Connect =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; error: ApiError }
  | { phase: "done"; data: Connected };

function Rows({
  rows,
}: {
  rows: readonly { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="ob-dl">
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OnboardingFlow() {
  const l = useL();
  const LABELS: Record<Step, string> = {
    "1": l("Shop", "दुकान", "Dukaan"),
    "2": "Paytm",
    "3": "WhatsApp",
    "4": l("Done", "पूरा", "Poora"),
  };
  const [step, setStep] = useQueryState<Step>("step", {
    defaultValue: "1",
    allowed: STEPS,
  });
  const [connect, setConnect] = useState<Connect>({ phase: "idle" });
  const shop = useApi<{ merchant: { name: string; ownerName: string } }>(
    "/api/dashboard/overview",
  );

  // move focus to the new step's heading, but not on first paint
  const title = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    title.current?.focus();
  }, [step]);

  async function runConnect() {
    setConnect({ phase: "loading" });
    try {
      const data = await postJson<Connected>("/api/onboarding/connect-paytm");
      setConnect({ phase: "done", data });
    } catch (e) {
      setConnect({ phase: "error", error: toApiError(e) });
    }
  }

  const at = STEPS.indexOf(step);
  const paytm = connect.phase === "done" ? connect.data.merchant : null;
  const shopName = paytm?.name ?? shop.data?.merchant.name;

  function stateOf(s: Step): {
    state: "done" | "current" | "todo";
    word: string;
  } {
    const i = STEPS.indexOf(s);
    if (i === at) return { state: "current", word: l("Now", "अभी", "Abhi") };
    if (i > at) return { state: "todo", word: l("Next", "आगे", "Aage") };
    if (s === "2" && !paytm)
      return { state: "todo", word: l("Skipped", "छोड़ा", "Chhoda") };
    if (s === "3")
      return {
        state: "done",
        word: l("Not connected", "जुड़ा नहीं", "Connect nahi"),
      };
    return { state: "done", word: l("Done", "हो गया", "Ho gaya") };
  }

  return (
    <>
      <picture className="ob-art">
        <source
          media="(max-width: 48rem)"
          srcSet="/brand/vyavahara-hero-mobile-soundbox-ledger-v1.svg"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/vyavahara-hero-soundbox-ledger-v1.svg"
          alt=""
          aria-hidden="true"
          width={1200}
          height={760}
        />
      </picture>
      <div className="ob-grid">
        <ol className="ob-steps" aria-label={l("Setup steps", "सेटअप के चरण", "Setup ke steps")}>
          {STEPS.map((s) => {
            const st = stateOf(s);
            return (
              <li
                key={s}
                className="ob-step"
                data-state={st.state}
                aria-current={st.state === "current" ? "step" : undefined}
              >
                <span className="ob-n num">{s}</span>
                <span className="ob-l">{LABELS[s]}</span>
                <span className="ob-s">{st.word}</span>
              </li>
            );
          })}
        </ol>

        <section className="ob-panel" aria-labelledby="ob-title">
          {step === "1" ? (
            <>
              <h2 id="ob-title" className="ob-title" ref={title} tabIndex={-1}>
                {l("Your shop", "आपकी दुकान", "Aapki dukaan")}
              </h2>
              {shop.error ? (
                <ErrorState
                  title={l(
                    "Could not load the shop",
                    "दुकान नहीं खुल पाई",
                    "Dukaan nahi khul payi",
                  )}
                  error={shop.error}
                  onRetry={shop.refetch}
                  retrying={shop.loading}
                />
              ) : !shop.data ? (
                <div
                  aria-busy="true"
                  aria-label={l(
                    "Loading the shop",
                    "दुकान लोड हो रही है",
                    "Dukaan load ho rahi hai",
                  )}
                >
                  <SkeletonRows rows={2} cols={2} />
                </div>
              ) : (
                <Rows
                  rows={[
                    {
                      label: l("Shop name", "दुकान का नाम", "Dukaan ka naam"),
                      value: shop.data.merchant.name,
                    },
                    {
                      label: l("Owner", "मालिक", "Malik"),
                      value: shop.data.merchant.ownerName,
                    },
                  ]}
                />
              )}
              <p className="ob-note">
                {l(
                  "This demo runs on one preloaded shop. Shop details cannot be edited in this build, so nothing here is saved.",
                  "यह डेमो एक पहले से भरी दुकान पर चलता है। इस वर्शन में दुकान की जानकारी बदली नहीं जा सकती, इसलिए यहाँ कुछ सेव नहीं होता।",
                  "Yeh demo ek pehle se bhari dukaan par chalta hai. Is build mein dukaan ki jaankari badli nahi ja sakti, isliye yahan kuch save nahi hota.",
                )}
              </p>
              <div className="ob-actions">
                <Button variant="primary" onClick={() => setStep("2")}>
                  {l(
                    "Continue to Paytm",
                    "Paytm पर आगे बढ़ें",
                    "Paytm par aage badho",
                  )}
                </Button>
              </div>
            </>
          ) : null}

          {step === "2" ? (
            <>
              <h2 id="ob-title" className="ob-title" ref={title} tabIndex={-1}>
                {l("Connect Paytm", "Paytm जोड़ें", "Paytm jodo")}
              </h2>
              <div className="ob-text">
                <p>
                  {l(
                    "This reads the demo shop's name, city and UPI id. There is no Paytm login in this build, and nothing is written.",
                    "यह डेमो दुकान का नाम, शहर और UPI id पढ़ता है। इस वर्शन में Paytm लॉगिन नहीं है और कुछ लिखा नहीं जाता।",
                    "Yeh demo dukaan ka naam, sheher aur UPI id padhta hai. Is build mein Paytm login nahi hai aur kuch likha nahi jaata.",
                  )}
                </p>
              </div>
              <div aria-live="polite" className="ob-text">
                {connect.phase === "loading" ? (
                  <p className="ob-note">Connecting to Paytm.</p>
                ) : null}
                {connect.phase === "error" ? (
                  <ErrorState
                    title={l(
                      "Could not connect Paytm",
                      "Paytm नहीं जुड़ पाया",
                      "Paytm nahi jud paya",
                    )}
                    error={connect.error}
                    onRetry={runConnect}
                  />
                ) : null}
                {connect.phase === "done" ? (
                  <>
                    <div className="ob-status">
                      <Badge tone="success">
                        {l("Connected", "जुड़ गया", "Connect ho gaya")}
                      </Badge>
                      <span>
                        {l(
                          "Paytm is linked to",
                          "Paytm जुड़ गया है:",
                          "Paytm jud gaya hai:",
                        )}{" "}
                        {connect.data.merchant.name}.
                      </span>
                    </div>
                    <Rows
                      rows={[
                        {
                          label: l("Shop", "दुकान", "Dukaan"),
                          value: connect.data.merchant.name,
                        },
                        {
                          label: l("Owner", "मालिक", "Malik"),
                          value: connect.data.merchant.ownerName,
                        },
                        ...(connect.data.merchant.city
                          ? [
                              {
                                label: l("City", "शहर", "Sheher"),
                                value: connect.data.merchant.city,
                              },
                            ]
                          : []),
                        ...(connect.data.merchant.upiId
                          ? [
                              {
                                label: "UPI id",
                                value: connect.data.merchant.upiId,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </>
                ) : null}
              </div>
              <div className="ob-actions">
                {connect.phase === "done" ? (
                  <Button
                    variant="primary"
                    icon={<CheckIcon size={16} />}
                    onClick={() => setStep("3")}
                  >
                    {l(
                      "Continue to WhatsApp",
                      "WhatsApp पर आगे बढ़ें",
                      "WhatsApp par aage badho",
                    )}
                  </Button>
                ) : connect.phase === "error" ? null : (
                  <Button
                    variant="primary"
                    loading={connect.phase === "loading"}
                    onClick={runConnect}
                  >
                    {l("Connect Paytm", "Paytm जोड़ें", "Paytm jodo")}
                  </Button>
                )}
                <Button variant="quiet" onClick={() => setStep("1")}>
                  {l("Back", "पीछे", "Peeche")}
                </Button>
                {connect.phase !== "done" ? (
                  <Button variant="quiet" onClick={() => setStep("3")}>
                    {l("Skip for now", "अभी छोड़ें", "Abhi chhodo")}
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}

          {step === "3" ? (
            <>
              <h2 id="ob-title" className="ob-title" ref={title} tabIndex={-1}>
                WhatsApp
              </h2>
              <div className="ob-status">
                <Badge tone="warn">
                  {l("Not connected yet", "अभी जुड़ा नहीं", "Abhi connect nahi")}
                </Badge>
              </div>
              <div className="ob-text">
                <p>
                  {l(
                    "Reports reach WhatsApp through Meta's official Cloud API. There is no QR code to scan.",
                    "रिपोर्ट Meta के आधिकारिक Cloud API से WhatsApp पर पहुँचती है। कोई QR कोड स्कैन नहीं करना पड़ता।",
                    "Reports Meta ke official Cloud API se WhatsApp par pahunchti hain. Koi QR code scan nahi karna padta.",
                  )}
                </p>
                <p>
                  {l(
                    "Add your number and send a report from the Reports page. Setup steps are in docs/WHATSAPP-SETUP.md.",
                    "रिपोर्ट पेज से अपना नंबर जोड़ें और रिपोर्ट भेजें। सेटअप के चरण docs/WHATSAPP-SETUP.md में हैं।",
                    "Reports page se apna number jodo aur report bhejo. Setup ke steps docs/WHATSAPP-SETUP.md mein hain.",
                  )}
                </p>
              </div>
              <div className="ob-actions">
                <Button variant="primary" onClick={() => setStep("4")}>
                  {l("Finish setup", "सेटअप पूरा करें", "Setup poora karo")}
                </Button>
                <Button variant="quiet" onClick={() => setStep("2")}>
                  Back
                </Button>
              </div>
            </>
          ) : null}

          {step === "4" ? (
            <>
              <h2 id="ob-title" className="ob-title" ref={title} tabIndex={-1}>
                {l(
                  "Setup is finished",
                  "सेटअप पूरा हो गया",
                  "Setup poora ho gaya",
                )}
              </h2>
              <Rows
                rows={[
                  {
                    label: l("Shop", "दुकान", "Dukaan"),
                    value:
                      shopName ??
                      (shop.error
                        ? l("Could not load", "नहीं खुल पाया", "Nahi khul paya")
                        : l("Loading", "लोड हो रहा है", "Load ho raha hai")),
                  },
                  {
                    label: "Paytm",
                    value: paytm ? (
                      <Badge tone="success">Connected</Badge>
                    ) : (
                      <Badge tone="warn">
                        {l(
                          "Not connected in this visit",
                          "इस बार जुड़ा नहीं",
                          "Is baar connect nahi hua",
                        )}
                      </Badge>
                    ),
                  },
                  {
                    label: "WhatsApp",
                    value: <Badge tone="warn">Not connected yet</Badge>,
                  },
                ]}
              />
              {paytm ? null : (
                <p className="ob-note">
                  {l("You can", "आप कभी भी", "Aap kabhi bhi")}{" "}
                  <Link href="/onboarding?step=2">
                    {l(
                      "connect Paytm",
                      "Paytm जोड़ सकते हैं",
                      "Paytm jod sakte hain",
                    )}
                  </Link>
                  {l(" any time.", "।", " sakte hain.")}
                </p>
              )}
              <div className="ob-actions">
                <Link
                  href="/dashboard"
                  className={buttonClass({ variant: "primary" })}
                >
                  {l("Open the dashboard", "डैशबोर्ड खोलें", "Dashboard kholo")}
                </Link>
                <Button variant="quiet" onClick={() => setStep("3")}>
                  Back
                </Button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}
