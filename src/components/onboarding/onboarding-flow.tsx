"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, Button, buttonClass, CheckIcon, ErrorState, SkeletonRows } from "@/components/ui";
import { ApiError, postJson, toApiError, useApi } from "@/lib/ui/api";
import { useQueryState } from "@/lib/ui/url-state";

const STEPS = ["1", "2", "3", "4"] as const;
type Step = (typeof STEPS)[number];

const LABELS: Record<Step, { name: string; hi?: string }> = {
  "1": { name: "Shop", hi: "दुकान" },
  "2": { name: "Paytm" },
  "3": { name: "WhatsApp" },
  "4": { name: "Done" },
};

/** Shape of `POST /api/onboarding/connect-paytm`. */
interface Connected {
  connected: true;
  merchant: { name: string; ownerName: string; city: string | null; upiId: string | null };
}

type Connect = { phase: "idle" } | { phase: "loading" } | { phase: "error"; error: ApiError } | { phase: "done"; data: Connected };

function Rows({ rows }: { rows: readonly { label: string; value: ReactNode }[] }) {
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
  const [step, setStep] = useQueryState<Step>("step", { defaultValue: "1", allowed: STEPS });
  const [connect, setConnect] = useState<Connect>({ phase: "idle" });
  const shop = useApi<{ merchant: { name: string; ownerName: string } }>("/api/dashboard/overview");

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

  function stateOf(s: Step): { state: "done" | "current" | "todo"; word: string } {
    const i = STEPS.indexOf(s);
    if (i === at) return { state: "current", word: "Now" };
    if (i > at) return { state: "todo", word: "Next" };
    if (s === "2" && !paytm) return { state: "todo", word: "Skipped" };
    if (s === "3") return { state: "done", word: "Not connected" };
    return { state: "done", word: "Done" };
  }

  return (
    <div className="ob-grid">
      <ol className="ob-steps" aria-label="Setup steps">
        {STEPS.map((s) => {
          const st = stateOf(s);
          return (
            <li key={s} className="ob-step" data-state={st.state} aria-current={st.state === "current" ? "step" : undefined}>
              <span className="ob-n num">{s}</span>
              <span className="ob-l">
                {LABELS[s].name}
                {LABELS[s].hi ? <span className="deva">{LABELS[s].hi}</span> : null}
              </span>
              <span className="ob-s">{st.word}</span>
            </li>
          );
        })}
      </ol>

      <section className="ob-panel" aria-labelledby="ob-title">
        {step === "1" ? (
          <>
            <h2 id="ob-title" className="ob-title" ref={title} tabIndex={-1}>
              Your shop
            </h2>
            {shop.error ? (
              <ErrorState title="Could not load the shop" error={shop.error} onRetry={shop.refetch} retrying={shop.loading} />
            ) : !shop.data ? (
              <div aria-busy="true" aria-label="Loading the shop">
                <SkeletonRows rows={2} cols={2} />
              </div>
            ) : (
              <Rows
                rows={[
                  { label: "Shop name", value: shop.data.merchant.name },
                  { label: "Owner", value: shop.data.merchant.ownerName },
                ]}
              />
            )}
            <p className="ob-note">This demo runs on one preloaded shop. Shop details cannot be edited in this build, so nothing here is saved.</p>
            <div className="ob-actions">
              <Button variant="primary" onClick={() => setStep("2")}>
                Continue to Paytm
              </Button>
            </div>
          </>
        ) : null}

        {step === "2" ? (
          <>
            <h2 id="ob-title" className="ob-title" ref={title} tabIndex={-1}>
              Connect Paytm
            </h2>
            <div className="ob-text">
              <p>This reads the demo shop&apos;s name, city and UPI id. There is no Paytm login in this build, and nothing is written.</p>
            </div>
            <div aria-live="polite" className="ob-text">
              {connect.phase === "loading" ? <p className="ob-note">Connecting to Paytm.</p> : null}
              {connect.phase === "error" ? <ErrorState title="Could not connect Paytm" error={connect.error} onRetry={runConnect} /> : null}
              {connect.phase === "done" ? (
                <>
                  <div className="ob-status">
                    <Badge tone="success">Connected</Badge>
                    <span>Paytm is linked to {connect.data.merchant.name}.</span>
                  </div>
                  <Rows
                    rows={[
                      { label: "Shop", value: connect.data.merchant.name },
                      { label: "Owner", value: connect.data.merchant.ownerName },
                      ...(connect.data.merchant.city ? [{ label: "City", value: connect.data.merchant.city }] : []),
                      ...(connect.data.merchant.upiId ? [{ label: "UPI id", value: connect.data.merchant.upiId }] : []),
                    ]}
                  />
                </>
              ) : null}
            </div>
            <div className="ob-actions">
              {connect.phase === "done" ? (
                <Button variant="primary" icon={<CheckIcon size={16} />} onClick={() => setStep("3")}>
                  Continue to WhatsApp
                </Button>
              ) : connect.phase === "error" ? null : (
                <Button variant="primary" loading={connect.phase === "loading"} onClick={runConnect}>
                  Connect Paytm
                </Button>
              )}
              <Button variant="quiet" onClick={() => setStep("1")}>
                Back
              </Button>
              {connect.phase !== "done" ? (
                <Button variant="quiet" onClick={() => setStep("3")}>
                  Skip for now
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
              <Badge tone="warn">Not connected yet</Badge>
            </div>
            <div className="ob-text">
              <p>Reports reach WhatsApp through Meta&apos;s official Cloud API. There is no QR code to scan.</p>
              <p>Add your number and send a report from the Reports page. Setup steps are in docs/WHATSAPP-SETUP.md.</p>
            </div>
            <div className="ob-actions">
              <Button variant="primary" onClick={() => setStep("4")}>
                Finish setup
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
              Setup is finished
            </h2>
            <Rows
              rows={[
                { label: "Shop", value: shopName ?? (shop.error ? "Could not load" : "Loading") },
                { label: "Paytm", value: paytm ? <Badge tone="success">Connected</Badge> : <Badge tone="warn">Not connected in this visit</Badge> },
                { label: "WhatsApp", value: <Badge tone="warn">Not connected yet</Badge> },
              ]}
            />
            {paytm ? null : (
              <p className="ob-note">
                You can <Link href="/onboarding?step=2">connect Paytm</Link> any time.
              </p>
            )}
            <div className="ob-actions">
              <Link href="/dashboard" className={buttonClass({ variant: "primary" })}>
                Open the dashboard
              </Link>
              <Button variant="quiet" onClick={() => setStep("3")}>
                Back
              </Button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
