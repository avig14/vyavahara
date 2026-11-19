"use client";

import { useState } from "react";
import { Button, Field, Input, buttonClass } from "@/components/ui";
import { CopyButton } from "@/components/pay/copy-button";
import { postJson, toApiError, type ApiError } from "@/lib/ui/api";
import { useMerchant } from "@/lib/ui/merchant";
import { rupees } from "@/lib/format";
import type { PayLinkResponse } from "./types";

export interface PayLinkMakerProps {
  customerId: string;
  name: string;
  /** what the customer owes now; the link asks for exactly this */
  owedPaise: number;
}

/**
 * `POST /api/pay { customerId }` makes a 7-day pay link for the whole baaki. Nothing is sent to the customer:
 * the owner copies the link or opens WhatsApp with the message filled in and picks the chat.
 */
export function PayLinkMaker({ customerId, name, owedPaise }: PayLinkMakerProps) {
  const merchant = useMerchant();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [link, setLink] = useState<PayLinkResponse | null>(null);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      setLink(await postJson<PayLinkResponse>("/api/pay", { customerId }));
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (owedPaise <= 0) return null;

  const text = link ? `Namaste ${name}, ${merchant?.name ?? "dukaan"} mein ${rupees(link.amountPaise)} baaki hai. Yahan se pay kar dijiye: ${link.url}` : "";

  return (
    <div className="kh-link">
      {link ? (
        <>
          <Field label={`Payment link, ${rupees(link.amountPaise)}, 7 din chalega`} hint="Link kisi ko bheja nahi gaya. Copy karke ya WhatsApp se bhejiye.">
            <div className="kh-link-row">
              <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={link.url} label="Copy" accessibleName="Copy payment link" />
              <a className={buttonClass({ variant: "secondary" })} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                WhatsApp pe bhejo
              </a>
            </div>
          </Field>
        </>
      ) : (
        <Button variant="primary" loading={busy} onClick={make}>
          Payment link banao
        </Button>
      )}
      {error ? (
        <p className="kh-link-err" role="alert">
          Link nahi bana: {error.message}
        </p>
      ) : null}
    </div>
  );
}
