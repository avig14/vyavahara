"use client";

import { useState, type ReactNode } from "react";
import { Button, ErrorState, buttonClass, useConfirm } from "@/components/ui";
import { postJson, toApiError, useApi } from "@/lib/ui/api";
import { rupeesExact } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { UpiQr } from "./upi-qr";

/** GET /api/pay/[token] */
interface PayInfo {
  shop: string;
  customer: string;
  amountPaise: number;
  paid: boolean;
  upiUri: string;
  /** PNG data URL of the same link, drawn by the server */
  qr: string;
}

/** The shop's UPI ID is the `pa` field of the link; the API does not send it on its own. */
function vpaOf(upiUri: string): string | null {
  const query = upiUri.split("?")[1];
  return query ? new URLSearchParams(query).get("pa") : null;
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pay-notice" role="status">
      <h1>{title}</h1>
      {children}
    </div>
  );
}

export function PayView({ token }: { token: string }) {
  const { data, error, loading, refetch } = useApi<PayInfo>(`/api/pay/${encodeURIComponent(token)}`);
  const { confirm, dialog } = useConfirm();
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  async function markPaid(info: PayInfo) {
    const ok = await confirm({
      title: "Pay ho gaya?",
      description: `${info.shop} ke khata mein ${rupeesExact(info.amountPaise)} jama likh diya jayega. Sirf tab dabayein jab UPI app mein payment poora ho chuka ho.`,
      confirmLabel: "Haan, pay kar diya",
      cancelLabel: "Abhi nahi",
    });
    if (!ok) return;
    setMarking(true);
    setMarkError(null);
    try {
      await postJson(`/api/pay/${encodeURIComponent(token)}`);
      refetch();
    } catch (e) {
      const err = toApiError(e);
      // 409: already marked paid, so the page should just show that
      if (err.status === 409) refetch();
      else setMarkError(err.message);
    } finally {
      setMarking(false);
    }
  }

  let body: ReactNode;
  if (error && !data) {
    if (error.status === 404) {
      body = (
        <Notice title="Yeh payment link nahi chal raha">
          <p>Link galat hai ya 7 din se purana ho gaya hai. Dukaan se naya link maangiye.</p>
          <p className="pay-en">This link is invalid or has expired. Ask the shop for a new one.</p>
        </Notice>
      );
    } else if (error.status === 503) {
      body = (
        <Notice title="Dukaan ka UPI ID abhi set nahi hai">
          <p>Abhi pay nahi ho sakta. Dukaan se baat kijiye.</p>
          <p className="pay-en">The shop has not set up its UPI ID yet.</p>
        </Notice>
      );
    } else {
      body = <ErrorState title="Page nahi khul paya" error={error} onRetry={refetch} retrying={loading} />;
    }
  } else if (!data) {
    body = (
      <div className="pay-skel" role="status" aria-busy="true">
        <span className="visually-hidden">Payment link khul raha hai</span>
        <span className="skel pay-skel-line" aria-hidden="true" />
        <span className="skel pay-skel-fig" aria-hidden="true" />
        <span className="skel pay-skel-btn" aria-hidden="true" />
        <span className="skel pay-skel-qr" aria-hidden="true" />
      </div>
    );
  } else if (data.paid) {
    body = (
      <>
        <p className="pay-shop">{data.shop}</p>
        <Notice title="Payment likh liya gaya">
          <p>
            {data.customer}, {rupeesExact(data.amountPaise)} khata mein jama ho chuka hai. Ab kuch karna baaki nahi.
          </p>
        </Notice>
      </>
    );
  } else {
    const vpa = vpaOf(data.upiUri);
    const amount = rupeesExact(data.amountPaise);
    body = (
      <>
        <p className="pay-shop">{data.shop}</p>
        <h1 className="pay-amount">
          <span className="pay-who">{data.customer}, aapka khata baaki hai</span>
          <span className="pay-fig figure">{amount}</span>
        </h1>

        <a className={buttonClass({ variant: "primary", block: true })} href={data.upiUri}>
          Pay with UPI app
        </a>
        <p className="pay-hint">Phone par yeh button UPI app kholta hai. Computer par QR scan karein.</p>

        <section className="pay-qr-wrap" aria-labelledby="pay-qr-h">
          <h2 id="pay-qr-h">Ya QR scan karein</h2>
          <UpiQr value={data.upiUri} fallbackSrc={data.qr} label={`UPI QR, ${amount}, ${data.shop}`} />
        </section>

        {vpa ? (
          <section className="pay-vpa" aria-labelledby="pay-vpa-h">
            <h2 id="pay-vpa-h">Ya UPI ID se bhejein</h2>
            <div className="pay-vpa-row">
              <code className="pay-vpa-id">{vpa}</code>
              <CopyButton text={vpa} label="Copy" accessibleName="Copy UPI ID" />
            </div>
            <p className="pay-hint">Apne UPI app mein yeh ID daalkar {amount} bhejein.</p>
          </section>
        ) : null}

        <section className="pay-done" aria-labelledby="pay-done-h">
          <h2 id="pay-done-h">Pay kar diya?</h2>
          <Button variant="secondary" loading={marking} onClick={() => markPaid(data)}>
            Maine pay kar diya
          </Button>
          {markError ? (
            <p className="pay-err" role="alert">
              Nahi likha ja saka: {markError}
            </p>
          ) : null}
        </section>
      </>
    );
  }

  return (
    <main className="pay">
      <div className="pay-col">{body}</div>
      <footer className="pay-foot">
        <p>Yeh link 7 din chalta hai. Vyavahāra se bana.</p>
      </footer>
      {dialog}
    </main>
  );
}
