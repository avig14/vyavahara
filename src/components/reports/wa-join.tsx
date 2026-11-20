"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Field, Input } from "@/components/ui";
import { UpiQr } from "@/components/pay/upi-qr";
import { postJson, toApiError, useApi } from "@/lib/ui/api";

export interface WaJoinInfo {
  provider: "twilio" | "meta" | null;
  configured: boolean;
  connected: boolean;
  number: string | null;
  join: { code: string; number: string; url: string } | null;
}

/**
 * Connect the owner's WhatsApp: scan the QR (or tap the link) and send the pre-filled message once.
 * Polls our own status route until the first message from the owner lands, then shows "connected".
 */
export function WaJoin() {
  const { data, refetch } = useApi<WaJoinInfo>("/api/whatsapp/status");
  const waiting = Boolean(data && data.provider === "twilio" && !data.connected);
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await postJson("/api/onboarding/whatsapp", { phone });
      setPhone("");
      refetch();
    } catch (e) {
      setErr(toApiError(e).message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(refetch, 4000);
    return () => clearInterval(t);
  }, [waiting, refetch]);

  if (!data) return <p className="wa-note">Check kar rahe hain…</p>;
  if (!data.configured) return <p className="wa-note wa-bad" role="status">WhatsApp abhi set up nahi hai. Steps: <code>docs/WHATSAPP-SETUP.md</code>.</p>;
  if (data.connected) return <Badge tone="success">✅ WhatsApp connected</Badge>;
  if (!data.number)
    return (
      <div className="wa-join">
        <Field label="Aapka WhatsApp number" hint="Pehle number daalo. Bot isi number ko pehchanega." error={err}>
          <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Button variant="primary" onClick={save} loading={saving} disabled={!phone.trim()}>
          Number save karo
        </Button>
      </div>
    );
  if (!data.join) return <p className="wa-note">Phone se is bot ko &ldquo;Hi&rdquo; bhejo, connect ho jayega.</p>;

  return (
    <div className="wa-join">
      <UpiQr value={data.join.url} label={`WhatsApp kholo aur "${data.join.code}" bhejo`} />
      <ol className="wa-steps">
        <li>Phone ka camera kholo aur QR scan karo, ya <a href={data.join.url} target="_blank" rel="noreferrer">yeh link</a> dabao.</li>
        <li>
          WhatsApp mein message <code>{data.join.code}</code> pehle se likha hoga. Bas <strong>Send</strong> dabao.
        </li>
        <li>Phir bot ko &ldquo;Hi&rdquo; bhejo. Yahan &ldquo;connected&rdquo; dikhne lagega.</li>
      </ol>
      <p className="wa-note">Number nahi bheja? WhatsApp mein {data.join.number} ko <code>{data.join.code}</code> likh kar bhejo. Har 3 din mein ek baar dobara karna padta hai (Twilio sandbox).</p>
    </div>
  );
}
