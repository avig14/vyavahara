"use client";

/**
 * Mic → 16 kHz mono 16-bit WAV in the browser (SOUNDBOX.md §5). WAV avoids any doubt about which compressed
 * formats speech-to-text accepts. Reports a live 0..1 level for the LED ring, stops by itself after ~1.2 s of
 * silence once speech has started, and never runs longer than maxMs. Nothing is uploaded or stored here.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const TARGET_RATE = 16_000;

export interface RecorderOpts {
  maxMs?: number;
  /** silence after speech that ends the clip */
  silenceMs?: number;
  /** RMS above this counts as speech */
  speechLevel?: number;
  /** nobody spoke for this long: give up and resolve null */
  idleMs?: number;
  onLevel?: (level: number) => void;
}

export type RecorderError = "denied" | "no_mic" | "unsupported" | "failed";

export interface Recorder {
  recording: boolean;
  /** resolves with the WAV when recording ends (silence, maxMs, or stop()); null if nothing was heard */
  start: () => Promise<Blob | null>;
  stop: () => void;
  cancel: () => void;
  error: RecorderError | null;
}

export function useWavRecorder(opts: RecorderOpts = {}): Recorder {
  const { maxMs = 10_000, silenceMs = 1200, speechLevel = 0.035, idleMs = 6000 } = opts;
  const onLevel = useRef(opts.onLevel);
  useEffect(() => {
    onLevel.current = opts.onLevel;
  }, [opts.onLevel]);

  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<RecorderError | null>(null);
  const finish = useRef<((keep: boolean) => void) | null>(null);

  const stop = useCallback(() => finish.current?.(true), []);
  const cancel = useCallback(() => finish.current?.(false), []);
  useEffect(() => () => finish.current?.(false), []);

  const start = useCallback(async (): Promise<Blob | null> => {
    if (finish.current) return null;
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      setError("unsupported");
      return null;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" ? "no_mic" : "failed");
      return null;
    }

    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    // ScriptProcessor is deprecated but works everywhere without a separate worklet file; 4096 frames ≈ 85 ms
    const proc = ac.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    const t0 = performance.now();
    let heardAt = 0;
    let lastLoud = 0;

    return new Promise<Blob | null>((resolve) => {
      let closed = false;
      const close = (keep: boolean) => {
        if (closed) return;
        closed = true;
        finish.current = null;
        proc.disconnect();
        src.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        void ac.close();
        setRecording(false);
        onLevel.current?.(0);
        resolve(keep && heardAt > 0 ? encodeWav(chunks, ac.sampleRate) : null);
      };
      finish.current = close;

      proc.onaudioprocess = (ev) => {
        const data = ev.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(data));
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!;
        const rms = Math.sqrt(sum / data.length);
        onLevel.current?.(Math.min(1, rms * 8));
        const now = performance.now();
        if (rms > speechLevel) {
          if (!heardAt) heardAt = now;
          lastLoud = now;
        }
        if (now - t0 > maxMs) close(true);
        else if (heardAt && now - lastLoud > silenceMs) close(true);
        // nobody spoke for a while: give up quietly
        else if (!heardAt && now - t0 > idleMs) close(false);
      };
      src.connect(proc);
      proc.connect(ac.destination);
      setRecording(true);
    });
  }, [maxMs, silenceMs, speechLevel, idleMs]);

  return { recording, start, stop, cancel, error };
}

/** Float32 chunks at `rate` → 16 kHz mono PCM16 WAV. Linear-interpolation resample is enough for speech. */
export function encodeWav(chunks: Float32Array[], rate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const input = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    input.set(c, o);
    o += c.length;
  }
  const ratio = rate / TARGET_RATE;
  const outLen = Math.floor(total / ratio);
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(i0 + 1, total - 1);
    const s = input[i0]! + (input[i1]! - input[i0]!) * (x - i0);
    const c = Math.max(-1, Math.min(1, s));
    pcm[i] = c < 0 ? c * 0x8000 : c * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.byteLength);
  const v = new DataView(buf);
  const str = (off: number, s: string) => [...s].forEach((ch, i) => v.setUint8(off + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.byteLength, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, TARGET_RATE, true);
  v.setUint32(28, TARGET_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.byteLength, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: "audio/wav" });
}
