"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { ApiError, postJson } from "@/lib/ui/api";
import { useL } from "@/lib/ui/lang";

/**
 * Open a customer, type the amount, save. The line under the box says exactly what will change before anything is written.
 */
export function PaymentQuick({
  customerId,
  name,
  owedPaise,
  onSaved,
}: {
  customerId: string;
  name: string;
  owedPaise: number;
  onSaved: () => void;
}) {
  const l = useL();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const rupee = Number(text);
  const valid =
    text.trim() !== "" &&
    Number.isFinite(rupee) &&
    rupee > 0 &&
    rupee <= 1_000_000_00;
  const paise = valid ? Math.round(rupee * 100) : 0;
  const after = owedPaise - paise;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await postJson("/api/khata/payment", {
        customerId,
        amountPaise: paise,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setMsg({
        ok: true,
        text: l(
          `Saved. ${rupees(paise)} received from ${name}.`,
          `सेव हो गया। ${name} से ${rupees(paise)} मिले।`,
          `Save ho gaya. ${name} se ${rupees(paise)} mile.`,
        ),
      });
      setText("");
      setNote("");
      onSaved();
    } catch (e) {
      setMsg({
        ok: false,
        text:
          e instanceof ApiError
            ? e.message
            : l(
                "Could not save. Nothing was changed.",
                "सेव नहीं हो पाया। कुछ नहीं बदला।",
                "Save nahi ho paya. Kuch nahi badla.",
              ),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="pq"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3 className="pq-h">
        {l("Record a payment", "पेमेंट लिखें", "Payment likho")}
      </h3>
      <div className="pq-row">
        <label className="pq-amt">
          <span className="pq-lab">
            {l("Amount received (₹)", "मिली रक़म (₹)", "Mili raqam (₹)")}
          </span>
          <input
            className="ctl num"
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            placeholder="500"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label className="pq-note">
          <span className="pq-lab">
            {l("Note (optional)", "नोट (वैकल्पिक)", "Note (optional)")}
          </span>
          <input
            className="ctl"
            type="text"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <Button
          variant="primary"
          type="submit"
          loading={busy}
          disabled={!valid}
        >
          {l("Save", "सेव करें", "Save karo")}
        </Button>
      </div>
      {valid ? (
        <p className="pq-preview" aria-live="polite">
          {after >= 0
            ? l(
                `Baaki will go from ${rupees(owedPaise)} to ${rupees(after)}.`,
                `बाक़ी ${rupees(owedPaise)} से ${rupees(after)} हो जाएगा।`,
                `Baaki ${rupees(owedPaise)} se ${rupees(after)} ho jayega.`,
              )
            : l(
                `This is ${rupees(-after)} more than the baaki. Check the amount.`,
                `यह बाक़ी से ${rupees(-after)} ज़्यादा है। रक़म देख लें।`,
                `Yeh baaki se ${rupees(-after)} zyada hai. Raqam dekh lo.`,
              )}
        </p>
      ) : null}
      {msg ? (
        <p
          className="pq-msg"
          data-ok={msg.ok ? "" : undefined}
          role={msg.ok ? "status" : "alert"}
        >
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}
