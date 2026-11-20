"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Field,
  Input,
  Select,
  useToast,
  type BadgeTone,
} from "@/components/ui";
import { postJson, toApiError, useApi } from "@/lib/ui/api";
import { istStamp } from "@/lib/ui/dates";
import { useL, type L } from "@/lib/ui/lang";
import { WaJoin } from "./wa-join";

interface WaStatusPayload {
  provider: "twilio" | "meta" | null;
  connected: boolean;
  configured: boolean;
  webhookReady: boolean;
  number: string | null;
  windowOpenUntil: string | null;
  messages: {
    id: string;
    kind: string;
    preview: string;
    status: string;
    errorText: string | null;
    at: string;
  }[];
}

interface SendResult {
  ok: true;
  kind: "report" | "template";
  parts?: number;
  notice?: string;
}

const statusMeta = (
  l: L,
): Record<string, { label: string; tone: BadgeTone }> => ({
  sending: { label: l("Sending", "भेज रहे हैं", "Bhej rahe hain"), tone: "info" },
  sent: { label: l("Sent", "भेज दिया", "Bhej diya"), tone: "info" },
  delivered: {
    label: l("Delivered to phone", "फ़ोन पर पहुँच गया", "Phone par pahunch gaya"),
    tone: "success",
  },
  read: { label: l("Read", "पढ़ लिया", "Padh liya"), tone: "success" },
  failed: { label: l("Not delivered", "नहीं गया", "Nahi gaya"), tone: "danger" },
});
const kindMeta = (l: L): Record<string, string> => ({
  report: l("Report", "रिपोर्ट", "Report"),
  template: l(
    "Chat-opening message",
    "चैट खोलने का संदेश",
    "Chat kholne ka message",
  ),
  reply: l("Bot reply", "बॉट का जवाब", "Bot ka jawab"),
  menu: l("Menu", "मेन्यू", "Menu"),
  alert: l("Khata alert", "खाता अलर्ट", "Khata alert"),
  pdf: l("PDF report", "PDF रिपोर्ट", "PDF report"),
});

/** Still on its way: keep checking. Delivered/read/failed are final. */
const inFlight = (s?: string) => s === "sending" || s === "sent";

/**
 * Send the same analysis to the owner's WhatsApp and watch it arrive. The token lives on the server; this only
 * calls our own routes. "Delivered" and "read" come from the provider's status callback, so without it the status stops at "Bhej diya".
 */
export function WhatsAppCard() {
  const l = useL();
  const toast = useToast();
  const state = useApi<WaStatusPayload>("/api/whatsapp/status");
  const { data, refetch } = state;
  const [kind, setKind] = useState("daily");
  const [period, setPeriod] = useState("today");
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
      const r = await postJson<{ number: string }>("/api/onboarding/whatsapp", {
        phone,
      });
      setPhone("");
      toast.push({
        title: l("Number saved", "नंबर सेव हो गया", "Number save ho gaya"),
        detail: r.number,
        tone: "success",
      });
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
      const r = await postJson<SendResult>("/api/whatsapp/send-report", {
        kind,
        period,
      });
      if (r.kind === "template") {
        setNotice(r.notice ?? null);
        toast.push({
          title: l(
            "Report not sent yet",
            "रिपोर्ट अभी नहीं गई",
            "Report abhi nahi gaya",
          ),
          detail: r.notice,
          tone: "neutral",
        });
      } else {
        toast.push({
          title: l("Report sent", "रिपोर्ट भेज दी", "Report bhej di"),
          detail: l(
            "The status shows below.",
            "स्थिति नीचे दिख रही है।",
            "Status neeche dikh raha hai.",
          ),
          tone: "success",
        });
      }
    } catch (e) {
      const err = toApiError(e);
      setNotice(err.message);
      toast.push({
        title: l(
          "Did not reach WhatsApp",
          "WhatsApp पर नहीं गई",
          "WhatsApp par nahi gayi",
        ),
        detail: err.message,
        tone: "error",
      });
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
        <h2 id="wa-title">
          {l("Report on WhatsApp", "WhatsApp पर रिपोर्ट", "WhatsApp par report")}
        </h2>
        <div className="wa-send">
          <Select
            aria-label={l("Which report", "कौन सी रिपोर्ट", "Kaun sa report")}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            options={[
              {
                value: "daily",
                label: l(
                  "Full report for today",
                  "आज की पूरी रिपोर्ट",
                  "Aaj ka poora report",
                ),
              },
              {
                value: "sales",
                label: l("Sales report", "बिक्री रिपोर्ट", "Sales report"),
              },
              {
                value: "customers",
                label: l("Customer report", "ग्राहक रिपोर्ट", "Customer report"),
              },
              {
                value: "vendors",
                label: l("Supplier report", "सप्लायर रिपोर्ट", "Supplier report"),
              },
              {
                value: "recommendations",
                label: l(
                  "Suggestions report",
                  "सुझावों की रिपोर्ट",
                  "Suggestions report",
                ),
              },
            ]}
          />
          {kind === "sales" ? (
            <Select
              aria-label={l("Which period", "कौन सी अवधि", "Kis period ka")}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={[
                { value: "today", label: l("Today", "आज", "Aaj") },
                {
                  value: "this_week",
                  label: l("This week", "इस हफ़्ते", "Is hafte"),
                },
                {
                  value: "this_month",
                  label: l("This month", "इस महीने", "Is mahine"),
                },
              ]}
            />
          ) : null}
          <Button
            variant="primary"
            onClick={sendReport}
            loading={sending}
            disabled={!canSend}
          >
            {l("Send on WhatsApp", "WhatsApp पर भेजें", "WhatsApp par bhejo")}
          </Button>
        </div>
      </div>

      {!data && !state.error ? (
        <p className="wa-note">
          {l("Checking…", "जाँच रहे हैं…", "Check kar rahe hain…")}
        </p>
      ) : null}
      {state.error ? (
        <p className="wa-note wa-bad" role="alert">
          {l(
            "Could not get WhatsApp details",
            "WhatsApp की जानकारी नहीं आ पाई",
            "WhatsApp ki jaankari nahi aa payi",
          )}
          : {state.error.message}
        </p>
      ) : null}

      {data && !configured ? (
        <p className="wa-note wa-bad" role="status">
          {l(
            "WhatsApp is not set up yet. Put",
            "WhatsApp अभी सेट नहीं है। ये तीनों",
            "WhatsApp abhi set up nahi hai.",
          )}{" "}
          <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>{" "}
          {l("and", "और", "aur")} <code>TWILIO_WHATSAPP_FROM</code>{" "}
          {l("in .env. Steps:", ".env में डालें। चरण:", ".env mein daalo. Steps:")}{" "}
          <code>docs/WHATSAPP-SETUP.md</code>.
        </p>
      ) : null}

      {data ? (
        <>
          <div className="wa-row">
            <Field
              label={l(
                "Your WhatsApp number",
                "आपका WhatsApp नंबर",
                "Aapka WhatsApp number",
              )}
              hint={
                data.number
                  ? l(
                      `Saved now: ${data.number}`,
                      `अभी सेव है: ${data.number}`,
                      `Abhi saved: ${data.number}`,
                    )
                  : l(
                      "A 10-digit number that has WhatsApp.",
                      "10 अंकों का नंबर, जिस पर WhatsApp चलता है।",
                      "10 digit number, jis par WhatsApp chalta hai.",
                    )
              }
              error={phoneError}
            >
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Button onClick={save} loading={saving} disabled={!phone.trim()}>
              {data.number
                ? l("Change number", "नंबर बदलें", "Number badlo")
                : l("Save number", "नंबर सेव करें", "Number save karo")}
            </Button>
          </div>

          {configured && !data.connected ? <WaJoin /> : null}

          {data.number && data.connected ? (
            <p className="wa-note">
              {data.windowOpenUntil
                ? l(
                    `The chat is open, the report will go straight until ${istStamp(data.windowOpenUntil)}.`,
                    `चैट खुली है, ${istStamp(data.windowOpenUntil)} तक रिपोर्ट सीधे जाएगी।`,
                    `Chat khula hai, ${istStamp(data.windowOpenUntil)} tak report seedha jayegi.`,
                  )
                : l(
                    "The chat is closed. First send 'Hi' to this number from your phone, then press Send.",
                    "चैट बंद है। पहले फ़ोन से इस नंबर को 'Hi' भेजें, फिर भेजें दबाएँ।",
                    "Chat band hai. Pehle phone se is number ko 'Hi' bhejo, phir Send dabao.",
                  )}
            </p>
          ) : null}

          {notice ? (
            <p className="wa-note wa-bad" role="status">
              {notice}
            </p>
          ) : null}

          {data.messages.length ? (
            <ul
              className="wa-log"
              aria-label={l("Earlier messages", "पिछले संदेश", "Pichle messages")}
            >
              {data.messages.map((m) => {
                const s = statusMeta(l)[m.status] ?? {
                  label: m.status,
                  tone: "neutral" as BadgeTone,
                };
                return (
                  <li key={m.id}>
                    <span className="wa-kind">
                      {kindMeta(l)[m.kind] ?? m.kind}
                    </span>
                    <time dateTime={m.at} className="num">
                      {istStamp(m.at)}
                    </time>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {m.status === "failed" && m.errorText ? (
                      <span className="wa-why">{m.errorText}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!data.webhookReady && data.messages.length ? (
            <p className="wa-note">
              {l(
                "The status callback is not set, so the status will stop at “Sent”. For “Delivered” and “Read” a public https URL (APP_BASE_URL) is needed.",
                "स्टेटस कॉलबैक सेट नहीं है, इसलिए स्थिति “भेज दिया” पर रुक जाएगी। “पहुँच गया” और “पढ़ लिया” के लिए सार्वजनिक https URL (APP_BASE_URL) चाहिए।",
                "Status callback set nahi hai, isliye status “Bhej diya” par ruk jayega. “Pahunch gaya” aur “Padh liya” ke liye public https URL (APP_BASE_URL) chahiye.",
              )}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
