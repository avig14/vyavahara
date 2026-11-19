"use client";

/**
 * Voice Saathi, hands-free. One click starts a session:
 *   greeting (namaste + 2 random insights) → listen → think → speak → listen → … until Stop,
 *   or until the owner stays quiet for two listens in a row (it then sleeps; one click wakes it).
 * Tapping a suggestion or an insight card asks it by text, inside or outside a session.
 * The mic is closed while the Soundbox speaks, so it never hears itself.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useWavRecorder, type RecorderError } from "@/lib/ui/wav-recorder";
import { playBytes, playClip, stopAudio, unlockAudio } from "./audio";
import { toolChips } from "./pipeline-model";

export type Phase = "off" | "idle" | "listening" | "thinking" | "speaking";
export type Step = "listen" | "understand" | "data" | "speak";

export interface Insight {
  id: string;
  tone: "risk" | "stock" | "money" | "good" | "info";
  label: string;
  title: string;
  spoken: string;
  ask: string;
}

export interface Turn {
  id: number;
  question: string | null;
  answer: string;
  route: string;
  chips: string[];
  sttMs: number | null;
  thinkMs: number | null;
  ttsMs: number | null;
  links: { kind: string; url: string }[];
  insights: Insight[];
}

interface ConverseResponse {
  status: "ok" | "no_speech";
  transcript?: string;
  sttMs?: number | null;
  route?: string;
  replyText?: string;
  spokenText?: string;
  tools?: string[];
  awaitingConfirmation?: boolean;
  links?: { kind: string; url: string }[];
  thinkMs?: number;
  lang?: string;
  sig?: string;
  voice?: boolean;
  insights?: Insight[];
  error?: string;
}

export interface Caption {
  key: number;
  question: string | null;
  answer: string;
  /** ms between words of the reveal; null until the voice starts */
  perWordMs: number | null;
}

export interface VoiceSession {
  phase: Phase;
  /** which mini-pipeline step is lit right now */
  step: Step | null;
  level: number;
  turns: Turn[];
  caption: Caption | null;
  awaiting: boolean;
  notice: string | null;
  voiceOn: boolean;
  micError: RecorderError | null;
  live: boolean;
  start: () => void;
  stop: () => void;
  /** tap on the orb: start, or skip the voice and listen now, or finish speaking early */
  tap: () => void;
  ask: (text: string) => void;
}

const MIC_MSG: Record<RecorderError, string> = {
  denied: "Mic ki permission nahi mili. Browser ke address bar se mic allow kijiye. Tab tak neeche ke sawal dabaiye.",
  no_mic: "Koi mic nahi mila. Neeche ke sawal dabakar poochiye.",
  unsupported: "Is browser mein mic recording nahi chalti. Chrome try kijiye, ya neeche ke sawal dabaiye.",
  failed: "Mic shuru nahi ho paya. Neeche ke sawal dabakar poochiye.",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seq = 0;

export function useVoiceSession(): VoiceSession {
  const [phase, setPhase] = useState<Phase>("off");
  const [step, setStep] = useState<Step | null>(null);
  const [level, setLevel] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [caption, setCaption] = useState<Caption | null>(null);
  const [awaiting, setAwaiting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [live, setLive] = useState(false);

  const liveRef = useRef(false);
  const busy = useRef(false);
  const queued = useRef<string | null>(null);
  const failures = useRef(0);
  const recorder = useWavRecorder({ onLevel: setLevel, idleMs: 8000, silenceMs: 1100 });
  const rec = useRef(recorder);
  useEffect(() => {
    rec.current = recorder;
  }, [recorder]);

  /** speak the signed reply; captions reveal word by word in time with the voice */
  const speak = useCallback(async (r: ConverseResponse, key: number, words: number): Promise<number | null> => {
    if (!r.spokenText || !r.sig || r.voice === false) {
      setVoiceOn(false);
      setCaption((c) => (c && c.key === key ? { ...c, perWordMs: 45 } : c));
      return null;
    }
    const t = performance.now();
    let res: Response;
    try {
      res = await fetch("/api/soundbox/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: r.spokenText, lang: r.lang, sig: r.sig }) });
    } catch {
      res = new Response(null, { status: 599 });
    }
    if (!res.ok) {
      setCaption((c) => (c && c.key === key ? { ...c, perWordMs: 45 } : c));
      if (res.status === 429) setNotice("Thodi der ke liye limit poori ho gayi. Jawab likha hua dikh raha hai.");
      return null;
    }
    const bytes = await res.arrayBuffer();
    const ttsMs = Math.round(performance.now() - t);
    setPhase("speaking");
    setStep("speak");
    await playBytes(bytes, setLevel, (dur) => setCaption((c) => (c && c.key === key ? { ...c, perWordMs: Math.max(60, (dur * 1000 * 0.92) / Math.max(1, words)) } : c)));
    setLevel(0);
    return ttsMs;
  }, []);

  /** one turn: text or audio in → reply on screen → voice out */
  const send = useCallback(
    async (input: { text: string } | { file: Blob } | { greet: true }): Promise<ConverseResponse | null> => {
      setPhase("thinking");
      setStep("file" in input ? "listen" : "understand");
      setNotice(null);
      const key = ++seq;
      const question = "text" in input ? input.text : null;
      setCaption({ key, question, answer: "", perWordMs: null });
      const filler = window.setTimeout(() => void playClip("ek-second"), 2600);
      const stepHint = window.setTimeout(() => setStep((s) => (s === "listen" ? "understand" : s === "understand" ? "data" : s)), 900);
      const stepHint2 = window.setTimeout(() => setStep((s) => (s === "understand" ? "data" : s)), 2200);
      let r: ConverseResponse;
      try {
        const res =
          "file" in input
            ? await fetch("/api/soundbox/converse", { method: "POST", body: formOf(input.file) })
            : await fetch("/api/soundbox/converse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify("greet" in input ? { greet: true } : { text: input.text }) });
        r = (await res.json()) as ConverseResponse;
        if (!res.ok) throw new Error(r.error ?? `Error ${res.status}`);
      } catch (e) {
        window.clearTimeout(filler);
        window.clearTimeout(stepHint);
        window.clearTimeout(stepHint2);
        setNotice(e instanceof Error ? e.message : "Kuch gadbad hui. Dobara boliye.");
        setCaption(null);
        setStep(null);
        failures.current += 1;
        // "samajh nahi aaya" only fits a misheard question, not a server problem
        if (!(e instanceof Error) || !/database|limit|server|went wrong|error \d/i.test(e.message)) await playClip("samajh-nahi");
        return null;
      }
      window.clearTimeout(filler);
      window.clearTimeout(stepHint);
      window.clearTimeout(stepHint2);
      failures.current = 0;
      if (r.status === "no_speech") {
        setCaption(null);
        setStep(null);
        return r;
      }
      const answer = r.replyText ?? "";
      const route = r.route ?? "agent";
      setStep("data");
      setCaption({ key, question: r.transcript || question, answer, perWordMs: null });
      setAwaiting(Boolean(r.awaitingConfirmation));
      const ttsMs = await speak(r, key, answer.split(/\s+/).length);
      setTurns((t) => [
        ...t.slice(-24),
        {
          id: key,
          question: r.transcript || question,
          answer,
          route,
          chips: toolChips(route, r.tools),
          sttMs: r.sttMs ?? null,
          thinkMs: r.thinkMs ?? null,
          ttsMs,
          links: r.links ?? [],
          insights: r.insights ?? [],
        },
      ]);
      setStep(null);
      return r;
    },
    [speak],
  );

  /** the hands-free loop */
  const loop = useCallback(async () => {
    let quiet = 0;
    while (liveRef.current) {
      const q = queued.current;
      if (q) {
        queued.current = null;
        await send({ text: q });
        continue;
      }
      setPhase("listening");
      setStep("listen");
      await sleep(200); // let the speaker tail die out before the mic opens
      if (!liveRef.current) break;
      const blob = await rec.current.start();
      setLevel(0);
      if (!liveRef.current) break;
      if (queued.current) continue;
      if (!blob) {
        if (rec.current.error) break;
        quiet += 1;
        if (quiet >= 2) {
          setNotice("Kaafi der se kuch suna nahi, isliye ruk gaya. Phir se baat karne ke liye button dabaiye.");
          break;
        }
        continue;
      }
      quiet = 0;
      const r = await send({ file: blob });
      if (!r) {
        // the server keeps failing: stop instead of hammering it; the notice says why
        if (failures.current >= 2) break;
        await sleep(400);
      }
    }
    liveRef.current = false;
    setLive(false);
    setPhase("off");
    setStep(null);
    setLevel(0);
  }, [send]);

  const start = useCallback(() => {
    unlockAudio();
    if (busy.current) return;
    busy.current = true;
    liveRef.current = true;
    setLive(true);
    setNotice(null);
    void (async () => {
      try {
        const greeted = turns.some((t) => t.route === "greet");
        if (!greeted) await send({ greet: true });
        if (liveRef.current) await loop();
      } finally {
        busy.current = false;
      }
    })();
  }, [loop, send, turns]);

  const stop = useCallback(() => {
    liveRef.current = false;
    queued.current = null;
    rec.current.cancel();
    stopAudio();
    setLive(false);
    setPhase("off");
    setStep(null);
    setLevel(0);
  }, []);

  const tap = useCallback(() => {
    unlockAudio();
    if (!liveRef.current) return start();
    if (phase === "speaking") return stopAudio(); // skip the rest, listen now
    if (phase === "listening") return rec.current.stop(); // done talking
  }, [phase, start]);

  const ask = useCallback(
    (text: string) => {
      unlockAudio();
      if (liveRef.current) {
        queued.current = text;
        if (phase === "listening") rec.current.cancel();
        if (phase === "speaking") stopAudio();
        return;
      }
      if (busy.current) return;
      busy.current = true;
      void (async () => {
        try {
          await send({ text });
        } finally {
          busy.current = false;
          if (!liveRef.current) {
            setPhase("off");
            setStep(null);
          }
        }
      })();
    },
    [phase, send],
  );

  useEffect(
    () => () => {
      liveRef.current = false;
      stopAudio();
    },
    [],
  );

  return {
    phase,
    step,
    level,
    turns,
    caption,
    awaiting,
    notice: notice ?? (recorder.error ? MIC_MSG[recorder.error] : null),
    voiceOn,
    micError: recorder.error,
    live,
    start,
    stop,
    tap,
    ask,
  };
}

function formOf(file: Blob) {
  const f = new FormData();
  f.append("file", file, "clip.wav");
  return f;
}
