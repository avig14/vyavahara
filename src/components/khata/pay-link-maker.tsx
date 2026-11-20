"use client";

import { useState } from "react";
import { useL } from "@/lib/ui/lang";
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
export function PayLinkMaker({
  customerId,
  name,
  owedPaise,
}: PayLinkMakerProps) {
  const l = useL();
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

  const text = link
    ? l(
        `Hello ${name}, ${rupees(link.amountPaise)} is pending at ${merchant?.name ?? "our shop"}. Please pay here: ${link.url}`,
        `नमस्ते ${name}, ${merchant?.name ?? "दुकान"} में ${rupees(link.amountPaise)} बाक़ी है। यहाँ से पेमेंट कर दीजिए: ${link.url}`,
        `Namaste ${name}, ${merchant?.name ?? "dukaan"} mein ${rupees(link.amountPaise)} baaki hai. Yahan se pay kar dijiye: ${link.url}`,
      )
    : "";

  return (
    <div className="kh-link">
      {link ? (
        <>
          <Field
            label={l(
              `Payment link, ${rupees(link.amountPaise)}, works for 7 days`,
              `पेमेंट लिंक, ${rupees(link.amountPaise)}, 7 दिन चलेगा`,
              `Payment link, ${rupees(link.amountPaise)}, 7 din chalega`,
            )}
            hint={l(
              "The link has not been sent to anyone. Copy it or send it on WhatsApp.",
              "लिंक किसी को भेजा नहीं गया है। कॉपी करें या WhatsApp से भेजें।",
              "Link kisi ko bheja nahi gaya. Copy karke ya WhatsApp se bhejiye.",
            )}
          >
            <div className="kh-link-row">
              <Input
                readOnly
                value={link.url}
                onFocus={(e) => e.currentTarget.select()}
              />
              <CopyButton
                text={link.url}
                label={l("Copy", "कॉपी", "Copy")}
                accessibleName={l(
                  "Copy payment link",
                  "पेमेंट लिंक कॉपी करें",
                  "Payment link copy karo",
                )}
              />
              <a
                className={buttonClass({ variant: "secondary" })}
                href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {l("Send on WhatsApp", "WhatsApp पर भेजें", "WhatsApp pe bhejo")}
              </a>
            </div>
          </Field>
        </>
      ) : (
        <Button variant="primary" loading={busy} onClick={make}>
          {l("Make a payment link", "पेमेंट लिंक बनाएँ", "Payment link banao")}
        </Button>
      )}
      {error ? (
        <p className="kh-link-err" role="alert">
          {l("Could not make the link", "लिंक नहीं बन पाया", "Link nahi bana")}:{" "}
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
