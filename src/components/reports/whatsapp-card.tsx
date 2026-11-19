"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Field, Input, useToast, type BadgeTone } from "@/components/ui";
import { postJson, toApiError, useApi } from "@/lib/ui/api";
import { istStamp } from "@/lib/ui/dates";
import { WaJoin } from "./wa-join";

interface WaStatusPayload {
  provider: "twilio" | "meta" | null;
  connected: boolean;
  configured: boolean;
  webhookReady: boolean;
  number: string | null;
  windowOpenUntil: string | null;
  messages: { id: string; kind: string; preview: string; status: string; errorText: string | null; at: string }[];
}

interface SendResult {
  ok: true;
  kind: "report" | "template";
  parts?: number;
  notice?: string;
}

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  sending: { label: "Bhej rahe hain", tone: "info" },
  sent: { label: "Bhej diya", tone: "info" },
  delivered: { label: "Phone par pahunch gaya", tone: "success" },
  read: { label: "Padh liya", tone: "success" },
  failed: { label: "Nahi gaya", tone: "danger" },
};
const KIND: Record<string, string> = { report: "Report", template: "Chat kholne ka message", reply: "Bot ka jawab", menu: "Menu", alert: "Khata alert", pdf: "PDF report" };

/** Still on its way: keep checking. Delivered/read/failed are final. */
const inFlight = (s?: string) => s === "sending" || s === "sent";

/**
 * Send the same analysis to the owner's WhatsApp and watch it arrive. The token lives on the server; this only
 * calls our own routes. "Delivered" and "read" come from the provider's status callback, so without it the status stops at "Bhej diya".
 */
export function WhatsAppCard() {
  const toast = useToast();
  const state = useApi<WaStatusPayload>("/api/whatsapp/status");
  const { data, refetch } = state;
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const latest = data?.messages[0]?.status;
  useEffect(() => {
    if (!inFlight(latest)) return;
    const t = setInterval(refetch, 4000);
    return () => clearInterval(t);
  }, [latest, refetch]);

  async function save() {
    setSaving(true);
    setPhoneError(null);
    try {
      const r = await postJson<{ number: string }>("/api/onboarding/whatsapp", { phone });
      setPhone("");
      toast.push({ title: "Number save ho gaya", detail: r.number, tone: "success" });
      refetch();
    } catch (e) {
      setPhoneError(toApiError(e).message);
    } finally {
      setSaving(false);
    }
  }

  async function sendReport() {
    setSending(true);
    setNotice(null);
    try {
      const r = await postJson<SendResult>("/api/whatsapp/send-report");
      if (r.kind === "template") {
        setNotice(r.notice ?? null);
        toast.push({ title: "Report abhi nahi gaya", detail: r.notice, tone: "neutral" });
      } else {
        toast.push({ title: "Report bhej di", detail: "Status neeche dikh raha hai.", tone: "success" });
      }
    } catch (e) {
      const err = toApiError(e);
      setNotice(err.message);
      toast.push({ title: "WhatsApp par nahi gayi", detail: err.message, tone: "error" });
    } finally {
      setSending(false);
      refetch();
    }
  }

  const configured = data?.configured ?? false;
  const canSend = Boolean(data && configured && data.number) && !sending;

  return (
    <section className="wa-card" aria-labelledby="wa-title">
      <div className="wa-head">
        <h2 id="wa-title">WhatsApp par report</h2>
        <Button variant="primary" onClick={sendReport} loading={sending} disabled={!canSend}>
          Send Report on WhatsApp
        </Button>
      </div>

      {!data && !state.error ? <p className="wa-note">Check kar rahe hain…</p> : null}
      {state.error ? <p className="wa-note wa-bad" role="alert">WhatsApp ki jaankari nahi aa payi: {state.error.message}</p> : null}

      {data && !configured ? (
        <p className="wa-note wa-bad" role="status">
          WhatsApp abhi set up nahi hai. <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> aur <code>TWILIO_WHATSAPP_FROM</code> .env mein daalo. Steps: <code>docs/WHATSAPP-SETUP.md</code>.
        </p>
      ) : null}

      {data ? (
        <>
          <div className="wa-row">
            <Field label="Aapka WhatsApp number" hint={data.number ? `Abhi saved: ${data.number}` : "10 digit number, jis par WhatsApp chalta hai."} error={phoneError}>
              <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Button onClick={save} loading={saving} disabled={!phone.trim()}>
              {data.number ? "Number badlo" : "Number save karo"}
            </Button>
          </div>

          {configured && !data.connected ? <WaJoin /> : null}

          {data.number && data.connected ? (
            <p className="wa-note">
              {data.windowOpenUntil
                ? `Chat khula hai, ${istStamp(data.windowOpenUntil)} tak report seedha jayegi.`
                : "Chat band hai. Pehle phone se is number ko 'Hi' bhejo, phir Send dabao."}
            </p>
          ) : null}

          {notice ? (
            <p className="wa-note wa-bad" role="status">
              {notice}
            </p>
          ) : null}

          {data.messages.length ? (
            <ul className="wa-log" aria-label="Pichle messages">
              {data.messages.map((m) => {
                const s = STATUS[m.status] ?? { label: m.status, tone: "neutral" as BadgeTone };
                return (
                  <li key={m.id}>
                    <span className="wa-kind">{KIND[m.kind] ?? m.kind}</span>
                    <time dateTime={m.at} className="num">
                      {istStamp(m.at)}
                    </time>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {m.status === "failed" && m.errorText ? <span className="wa-why">{m.errorText}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!data.webhookReady && data.messages.length ? (
            <p className="wa-note">Status callback set nahi hai, isliye status &ldquo;Bhej diya&rdquo; par ruk jayega. &ldquo;Pahunch gaya&rdquo; aur &ldquo;Padh liya&rdquo; ke liye public https URL (APP_BASE_URL) chahiye.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
