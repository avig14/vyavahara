"use client";

/**
 * Voice Saathi (dashboard): the Paytm Soundbox you can talk to, in the browser.
 * One click starts a hands-free conversation: it greets with two of today's important things, then keeps
 * listening and answering in Hinglish/Hindi/English until Stop. Live captions reveal in time with the voice;
 * insight cards and suggestions ask by tap; every past turn can show what happened inside.
 */
import { useEffect, useRef } from "react";
import { PageHeader, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/ui/api";
import { cx } from "@/lib/ui/cx";
import { ROUTE_LABEL } from "./pipeline-model";
import { Orb } from "./orb";
import { useVoiceSession, type Caption, type Insight, type Step, type Turn, type VoiceSession } from "./use-voice-session";

const SUGGEST = ["Aaj ki sale kitni hui?", "Kal ki sales kitni thi?", "Kya khatam hone wala hai?", "Kitne logon ka udhaar baaki hai?", "Is mahine ka munafa?", "Maggi ke 20 packet aaye hain", "कल की बिक्री कितनी थी?"];

const STEPS: { id: Step; label: string; hi: string }[] = [
  { id: "listen", label: "Suna", hi: "सुना" },
  { id: "understand", label: "Samjha", hi: "समझा" },
  { id: "data", label: "Hisaab", hi: "हिसाब" },
  { id: "speak", label: "Bola", hi: "बोला" },
];

const STATUS: Record<VoiceSession["phase"], string> = {
  off: "Band hai",
  idle: "Taiyaar",
  listening: "Sun raha hoon, boliye",
  thinking: "Hisaab nikal raha hoon",
  speaking: "Bol raha hoon",
};

const TONE_LABEL: Record<Insight["tone"], string> = { risk: "Risk", stock: "Stock", money: "Paisa", good: "Achhi khabar", info: "Suggestion" };

export function VoiceStudio() {
  const s = useVoiceSession();
  const insights = useApi<{ insights: Insight[] }>("/api/soundbox/insights");

  // Space = tap the orb (not while typing or on another control)
  const tapRef = useRef(s.tap);
  useEffect(() => {
    tapRef.current = s.tap;
  }, [s.tap]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, button, a, [role=tab]") || t.isContentEditable)) return;
      e.preventDefault();
      tapRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const greetPicked = s.turns.find((t) => t.route === "greet")?.insights.map((i) => i.id) ?? [];

  return (
    <div className="vs">
      <PageHeader
        title="Voice Saathi"
        hindi="बोलिए"
        description="Ek baar shuru kijiye, phir bas boliye. Soundbox sunta hai, aapki dukaan ka hisaab nikalta hai, aur bolkar batata hai. Hindi, English, Hinglish, sab chalega."
      />

      <section className="vs-stage" data-phase={s.phase} data-live={s.live ? "" : undefined} aria-label="Voice Saathi">
        <div className="vs-top">
          <span className="vs-status" aria-live="polite">
            <span className="vs-status-dot" aria-hidden="true" />
            {STATUS[s.phase]}
          </span>
          <ol className="vs-steps" aria-label="What is happening">
            {STEPS.map((st, i) => {
              const at = s.step ? STEPS.findIndex((x) => x.id === s.step) : -1;
              return (
                <li key={st.id} data-state={at === i ? "on" : at > i ? "done" : undefined}>
                  <span className="vs-step-dot" aria-hidden="true" />
                  {st.label} <span className="deva" lang="hi">{st.hi}</span>
                </li>
              );
            })}
          </ol>
          {s.live ? (
            <button type="button" className="vs-btn vs-btn-stop" onClick={s.stop}>
              <span className="vs-btn-sq" aria-hidden="true" /> Band karein
            </button>
          ) : (
            <button type="button" className="vs-btn vs-btn-go" onClick={s.start}>
              Baat shuru karein
            </button>
          )}
        </div>

        <div className="vs-body">
          <div className="vs-orb-wrap">
            <Orb phase={s.phase} level={s.level} onTap={s.tap} label={orbLabel(s)} />
            <p className="vs-orb-hint">{orbHint(s)}</p>
          </div>

          <div className="vs-captions">
            <LiveCaption caption={s.caption} phase={s.phase} awaiting={s.awaiting} />
            {s.awaiting && s.phase !== "thinking" ? (
              <div className="vs-confirm" role="group" aria-label="Haan ya nahi">
                <span>Boliye ya dabaiye:</span>
                <button type="button" className="vs-chip vs-chip-yes" onClick={() => s.ask("haan")}>
                  Haan
                </button>
                <button type="button" className="vs-chip" onClick={() => s.ask("nahi")}>
                  Nahi
                </button>
              </div>
            ) : null}
            {s.notice ? (
              <p className="vs-notice" role="alert">
                {s.notice}
              </p>
            ) : null}
            {!s.voiceOn ? <p className="vs-notice">Awaaz band hai (Sarvam key nahi mili). Jawab likha hua dikh raha hai.</p> : null}
          </div>
        </div>

        <div className="vs-suggest">
          <span className="vs-suggest-label">Yeh bhi pooch sakte hain</span>
          <ul>
            {SUGGEST.map((q, i) => (
              <li key={q} style={{ animationDelay: `${i * 50}ms` }}>
                <button type="button" className="vs-chip" disabled={s.phase === "thinking"} onClick={() => s.ask(q)} lang={/[ऀ-ॿ]/.test(q) ? "hi" : undefined}>
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="vs-sec" aria-labelledby="vs-ins-title">
        <div className="vs-sec-head">
          <h2 id="vs-ins-title">Aaj ki zaroori baatein</h2>
          <p>Soundbox shuru hote hi inme se do bolta hai. Kisi bhi card ko dabaiye, woh uske baare mein bata dega.</p>
        </div>
        {!insights.data && insights.loading ? <Skeleton shape="rows" count={3} cols={3} label="Loading insights" /> : null}
        {insights.error && !insights.data ? <p className="vs-notice">Insights load nahi hue: {insights.error.message}</p> : null}
        {insights.data ? (
          insights.data.insights.length ? (
            <ul className="vs-cards">
              {insights.data.insights.map((it, i) => (
                <li key={it.id} style={{ animationDelay: `${i * 60}ms` }}>
                  <button type="button" className={cx("vs-card", greetPicked.includes(it.id) && "vs-card-said")} data-tone={it.tone} onClick={() => s.ask(it.ask)} disabled={s.phase === "thinking"}>
                    <span className="vs-card-tag">
                      {it.label}
                      <span className="visually-hidden"> ({TONE_LABEL[it.tone]})</span>
                    </span>
                    <span className="vs-card-title">{it.title}</span>
                    <span className="vs-card-ask">
                      {greetPicked.includes(it.id) ? "Soundbox ne bataya · " : ""}Poochiye: {it.ask}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="vs-muted">Aaj sab theek hai: koi high-risk udhaar, khatam stock ya due payment nahi.</p>
          )
        ) : null}
      </section>

      <section className="vs-sec" aria-labelledby="vs-hist-title">
        <div className="vs-sec-head">
          <h2 id="vs-hist-title">Baatcheet</h2>
          <p>Har jawab ke neeche dekhiye andar kya hua: kaunsa data padha, kitna time laga.</p>
        </div>
        {s.turns.length ? (
          <ol className="vs-history">
            {[...s.turns].reverse().map((t) => (
              <HistoryItem key={t.id} t={t} />
            ))}
          </ol>
        ) : (
          <p className="vs-muted">Abhi koi baat nahi hui. Upar &ldquo;Baat shuru karein&rdquo; dabaiye.</p>
        )}
      </section>
    </div>
  );
}

function orbLabel(s: VoiceSession) {
  if (!s.live) return "Start talking to the Soundbox";
  if (s.phase === "speaking") return "Skip the answer and speak";
  if (s.phase === "listening") return "Done speaking";
  return "Soundbox is busy";
}

function orbHint(s: VoiceSession) {
  if (!s.live) return "Dabaiye ya Space. Ek baar shuru, phir bas boliye.";
  if (s.phase === "listening") return "Boliye. Chup hote hi main samajh jaunga.";
  if (s.phase === "speaking") return "Beech mein bolna hai? Orb dabaiye.";
  if (s.phase === "thinking") return "Aapki dukaan ka data dekh raha hoon…";
  return "";
}

function LiveCaption({ caption, phase, awaiting }: { caption: Caption | null; phase: VoiceSession["phase"]; awaiting: boolean }) {
  if (!caption)
    return (
      <div className="vs-cap vs-cap-empty">
        <p className="vs-cap-q">Aap pooch sakte hain</p>
        <p className="vs-cap-a vs-cap-placeholder">&ldquo;Aaj ki sale kitni hui?&rdquo; &middot; &ldquo;Kya khatam hone wala hai?&rdquo; &middot; &ldquo;Suresh ka udhaar kitna hai?&rdquo;</p>
      </div>
    );
  const words = caption.answer ? caption.answer.split(/\s+/) : [];
  return (
    <div className="vs-cap" key={caption.key}>
      <p className="vs-cap-q">{caption.question ? <>Aapne kaha: &ldquo;{caption.question}&rdquo;</> : phase === "thinking" ? "Sun liya, samajh raha hoon…" : "Soundbox"}</p>
      {caption.answer && caption.perWordMs !== null ? (
        <p className={cx("vs-cap-a", awaiting && "vs-cap-ask")} aria-live="polite">
          {words.map((w, i) => (
            <span key={i} className="vs-word" style={{ animationDelay: `${Math.round(i * caption.perWordMs!)}ms` }}>
              {w}{" "}
            </span>
          ))}
        </p>
      ) : (
        <p className="vs-cap-a vs-cap-wait" aria-live="polite">
          <span className="vs-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="visually-hidden">Working</span>
        </p>
      )}
    </div>
  );
}

function ms(n: number | null) {
  if (n === null) return null;
  return n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`;
}

function HistoryItem({ t }: { t: Turn }) {
  const timing = [t.sttMs !== null && `sunna ${ms(t.sttMs)}`, t.thinkMs !== null && `hisaab ${ms(t.thinkMs)}`, t.ttsMs !== null && `awaaz ${ms(t.ttsMs)}`].filter(Boolean).join(" · ");
  return (
    <li className="vs-turn">
      {t.question ? <p className="vs-turn-q">{t.question}</p> : null}
      <p className="vs-turn-a">{t.answer}</p>
      <details className="vs-inside">
        <summary>Andar kya hua</summary>
        <p className="vs-inside-route">{ROUTE_LABEL[t.route] ?? t.route}</p>
        {t.chips.length ? (
          <ul className="vs-inside-chips" aria-label="Data used">
            {t.chips.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
        {timing ? <p className="vs-inside-time figure">{timing}</p> : null}
        {t.links.length ? (
          <p className="vs-inside-links">
            {t.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                {l.kind === "pdf" ? "PDF kholiye" : "Link kholiye"}
              </a>
            ))}
          </p>
        ) : null}
      </details>
    </li>
  );
}
