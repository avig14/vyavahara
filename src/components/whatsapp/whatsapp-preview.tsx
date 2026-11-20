"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/ui";
import { postJson, toApiError } from "@/lib/ui/api";
import { formatWa, tokenizeWa, type WaToken } from "@/lib/wa/format-wa";
import { textForTap, type Interactive } from "@/lib/wa/interactive";

interface Msg {
  id: number;
  from: "me" | "bot";
  text: string;
  at: Date;
  /** tappable options under a bot message */
  interactive?: Interactive;
  /** the bot has answered this message (blue ticks) */
  answered?: boolean;
}

const clock = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const Verified = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-label="Verified business" role="img">
    <path fill="#25d366" d="M12 1.5l2.6 1.7 3.1-.3 1.2 2.9 2.7 1.6-.6 3.1 1.3 2.8-2 2.4-.1 3.1-3 .9-1.9 2.5-2.9-1.1-2.9 1.1-1.9-2.5-3-.9-.1-3.1-2-2.4 1.3-2.8-.6-3.1 2.7-1.6 1.2-2.9 3.1.3z" />
    <path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 12.3l2.7 2.7L16 9.6" />
  </svg>
);

const Ticks = ({ read }: { read: boolean }) => (
  <svg viewBox="0 0 18 12" width="16" height="11" aria-label={read ? "Read" : "Sent"} role="img">
    <path fill="none" stroke={read ? "#53bdeb" : "#8696a0"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M1 6.5l3.2 3.2L10.5 2.5M7 8.4l1.3 1.3L14.6 2.5" />
  </svg>
);

/** WhatsApp allows bold inside italic and the other way round, so formatted tokens are rendered recursively. */
function Inline({ tokens }: { tokens: WaToken[] }) {
  return (
    <>
      {tokens.map((t, j) =>
        t.kind === "bold" ? (
          <b key={j}>
            <Inline tokens={tokenizeWa(t.text)} />
          </b>
        ) : t.kind === "italic" ? (
          <i key={j}>
            <Inline tokens={tokenizeWa(t.text)} />
          </i>
        ) : t.kind === "link" ? (
          <a key={j} href={t.text} target="_blank" rel="noreferrer noopener">
            {t.text}
          </a>
        ) : (
          <span key={j}>{t.text}</span>
        ),
      )}
    </>
  );
}

function Text({ text }: { text: string }) {
  return (
    <>
      {formatWa(text).map((line, i) => (
        <p key={i}>{line.length === 0 ? " " : <Inline tokens={line} />}</p>
      ))}
    </>
  );
}

function Bubble({ m, live, onTap, onOpenList }: { m: Msg; live: boolean; onTap: (id: string, title: string) => void; onOpenList: () => void }) {
  const i = m.interactive;
  return (
    <div className={`wsim-msg wsim-${m.from}`}>
      <div className="wsim-bubble">
        <Text text={m.text} />
        <span className="wsim-time">
          {clock(m.at)}
          {m.from === "me" ? <Ticks read={Boolean(m.answered)} /> : null}
        </span>
      </div>
      {i?.kind === "buttons" ? (
        <div className="wsim-actions">
          {i.buttons.map((b) => (
            <button key={b.id} type="button" disabled={!live} onClick={() => onTap(b.id, b.title)}>
              <span aria-hidden="true">↩</span> {b.title}
            </button>
          ))}
        </div>
      ) : null}
      {i?.kind === "list" ? (
        <div className="wsim-actions">
          <button type="button" disabled={!live} onClick={onOpenList}>
            <span aria-hidden="true">☰</span> {i.button}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function WhatsappPreview() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const next = useRef(1);
  const started = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  async function send(raw: string, shown?: string) {
    const t = raw.trim();
    if (!t || busy) return;
    setError(null);
    setText("");
    setSheet(false);
    const mine = next.current++;
    setMsgs((m) => [...m, { id: mine, from: "me", text: shown ?? t, at: new Date() }]);
    setBusy(true);
    try {
      const r = await postJson<{ parts: string[]; interactive: Interactive }>("/api/whatsapp/simulate", { text: t });
      setMsgs((m) => m.map((x) => (x.id === mine ? { ...x, answered: true } : x)));
      for (let k = 0; k < r.parts.length; k++) {
        await new Promise((res) => setTimeout(res, 350));
        const last = k === r.parts.length - 1;
        setMsgs((m) => [...m, { id: next.current++, from: "bot", text: r.parts[k], at: new Date(), interactive: last ? r.interactive : undefined }]);
      }
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send("Hi");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastBot = [...msgs].reverse().find((m) => m.from === "bot");
  const list = lastBot?.interactive?.kind === "list" ? lastBot.interactive : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  return (
    <>
      <PageHeader
        title="WhatsApp preview"
        hindi="व्हाट्सऐप"
        description="Bot ka chat aise dikhta hai: buttons dabaiye ya likhiye. Wahi menu aur reports jo WhatsApp par jaate hain; kuch bhi Meta ko nahi bheja jaata."
      />
      <div className="wsim">
        <div className="wsim-phone" role="region" aria-label="WhatsApp chat preview">
          <header className="wsim-head">
            <span className="wsim-back" aria-hidden="true">‹</span>
            <span className="wsim-avatar" aria-hidden="true">V</span>
            <div className="wsim-who">
              <b>
                Vyavahāra <Verified />
              </b>
              <small>{busy ? "typing…" : "Business account"}</small>
            </div>
          </header>
          <div className="wsim-body" aria-live="polite">
            <p className="wsim-chip">Aaj</p>
            <p className="wsim-lock">Yeh ek preview hai. Kuch bhi WhatsApp ko nahi bheja jaata.</p>
            {msgs.map((m) => (
              <Bubble key={m.id} m={m} live={m === lastBot && !busy} onTap={(id, title) => void send(textForTap(id), title)} onOpenList={() => setSheet(true)} />
            ))}
            {busy ? (
              <div className="wsim-msg wsim-bot">
                <div className="wsim-bubble wsim-typing" aria-label="Bot likh raha hai">
                  <span /><span /><span />
                </div>
              </div>
            ) : null}
            <div ref={end} />
          </div>
          {error ? <p className="wsim-error" role="alert">{error}</p> : null}
          <form className="wsim-form" onSubmit={onSubmit}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" aria-label="Message" maxLength={500} disabled={busy} />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send">➤</button>
          </form>
          {sheet && list ? (
            <div className="wsim-sheet" role="dialog" aria-label={list.title}>
              <div className="wsim-sheet-head">
                <button type="button" onClick={() => setSheet(false)} aria-label="Band karein">✕</button>
                <b>{list.title}</b>
              </div>
              <div className="wsim-sheet-body">
                {list.sections.map((s) => (
                  <section key={s.title}>
                    <h3>{s.title}</h3>
                    {s.rows.map((r) => (
                      <button key={r.id} type="button" onClick={() => void send(textForTap(r.id), r.title)}>
                        <span>
                          <b>{r.title}</b>
                          {r.description ? <small>{r.description}</small> : null}
                        </span>
                        <i aria-hidden="true" />
                      </button>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
