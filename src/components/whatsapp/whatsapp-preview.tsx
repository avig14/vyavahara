"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, PageHeader } from "@/components/ui";
import { postJson, toApiError } from "@/lib/ui/api";
import { formatWa } from "@/lib/wa/format-wa";

interface Msg {
  id: number;
  from: "me" | "bot";
  text: string;
  at: Date;
}

const QUICK = [
  { label: "Hi", text: "Hi" },
  { label: "Aaj ka report", text: "1" },
  { label: "Sales", text: "6" },
  { label: "Sales (week)", text: "6 week" },
  { label: "Customers", text: "7" },
  { label: "Suppliers", text: "8" },
  { label: "Suggestions", text: "9" },
  { label: "Stock", text: "2" },
  { label: "Udhaar", text: "3" },
];

const clock = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function Bubble({ m }: { m: Msg }) {
  return (
    <div className={`wsim-row wsim-${m.from}`}>
      <div className="wsim-bubble">
        {formatWa(m.text).map((line, i) => (
          <p key={i}>
            {line.length === 0
              ? " "
              : line.map((t, j) =>
                  t.kind === "bold" ? (
                    <b key={j}>{t.text}</b>
                  ) : t.kind === "italic" ? (
                    <i key={j}>{t.text}</i>
                  ) : t.kind === "link" ? (
                    <a key={j} href={t.text} target="_blank" rel="noreferrer noopener">
                      {t.text}
                    </a>
                  ) : (
                    <span key={j}>{t.text}</span>
                  ),
                )}
          </p>
        ))}
        <span className="wsim-time">{clock(m.at)}</span>
      </div>
    </div>
  );
}

export function WhatsappPreview() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = useRef(1);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  async function send(raw: string) {
    const t = raw.trim();
    if (!t || busy) return;
    setError(null);
    setText("");
    setMsgs((m) => [...m, { id: next.current++, from: "me", text: t, at: new Date() }]);
    setBusy(true);
    try {
      const r = await postJson<{ parts: string[] }>("/api/whatsapp/simulate", { text: t });
      for (const p of r.parts) {
        setMsgs((m) => [...m, { id: next.current++, from: "bot", text: p, at: new Date() }]);
        await new Promise((res) => setTimeout(res, 250));
      }
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  return (
    <>
      <PageHeader
        title="WhatsApp preview"
        hindi="व्हाट्सऐप"
        description="Yeh bot ke jawab ka preview hai: wahi menu aur reports jo WhatsApp par jaate hain. Kuch bhi Meta ko nahi bheja jaata."
      />
      <div className="wsim">
        <div className="wsim-phone" role="region" aria-label="WhatsApp chat preview">
          <header className="wsim-head">
            <span className="wsim-avatar" aria-hidden="true">V</span>
            <div>
              <b>Vyavahāra</b>
              <small>{busy ? "typing…" : "business account · preview"}</small>
            </div>
          </header>
          <div className="wsim-body" aria-live="polite">
            {msgs.length === 0 ? <p className="wsim-empty">Neeche se koi button dabaiye, ya <b>Hi</b> likhiye.</p> : null}
            {msgs.map((m) => (
              <Bubble key={m.id} m={m} />
            ))}
            {busy ? (
              <div className="wsim-row wsim-bot">
                <div className="wsim-bubble wsim-typing" aria-label="Bot likh raha hai">
                  <span /><span /><span />
                </div>
              </div>
            ) : null}
            <div ref={end} />
          </div>
          {error ? <p className="wsim-error" role="alert">{error}</p> : null}
          <div className="wsim-quick">
            {QUICK.map((q) => (
              <button key={q.label} type="button" onClick={() => void send(q.text)} disabled={busy}>
                {q.label}
              </button>
            ))}
          </div>
          <form className="wsim-form" onSubmit={onSubmit}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message likhiye…" aria-label="Message" maxLength={500} disabled={busy} />
            <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
              Send
            </Button>
          </form>
        </div>
        <aside className="wsim-help">
          <h2>Kya poochh sakte hain</h2>
          <ul>
            <li><b>1</b> aaj ka poora report</li>
            <li><b>6</b> sales report (<i>6 week</i>, <i>6 month</i>)</li>
            <li><b>7</b> customer report</li>
            <li><b>8</b> supplier report</li>
            <li><b>9</b> suggestions (kya karein)</li>
            <li><b>2</b> stock · <b>3</b> udhaar · <b>4</b> supplier payments · <b>5</b> PDF</li>
            <li>Ya seedha poochhiye, jaise <i>&ldquo;aaj kitni sale hui?&rdquo;</i></li>
          </ul>
          <p className="wsim-note">Preview mein live data dikhta hai. Asli WhatsApp par bhejne ke liye Meta ka business account chahiye.</p>
        </aside>
      </div>
    </>
  );
}
