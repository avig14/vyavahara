"use client";

/**
 * Plays the Soundbox voice through Web Audio so the device can animate to the real output level.
 * One AudioContext, created on the first button press (a user gesture, so browsers allow sound).
 */
let ctx: AudioContext | null = null;
let current: { src: AudioBufferSourceNode; stop: () => void } | null = null;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call inside the click handler so later playback is allowed. */
export function unlockAudio() {
  try {
    ac();
  } catch {
    /* no audio support: the reply text still shows */
  }
}

export function stopAudio() {
  current?.stop();
  current = null;
}

/** Play WAV/MP3 bytes; reports a 0..1 level about every animation frame; resolves when playback ends or is stopped. */
export async function playBytes(bytes: ArrayBuffer, onLevel?: (l: number) => void, onStart?: (durationSec: number) => void): Promise<void> {
  stopAudio();
  const a = ac();
  const buf = await a.decodeAudioData(bytes.slice(0));
  const src = a.createBufferSource();
  src.buffer = buf;
  const an = a.createAnalyser();
  an.fftSize = 512;
  src.connect(an);
  an.connect(a.destination);
  const data = new Uint8Array(an.fftSize);
  let raf = 0;
  const tick = () => {
    an.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i]! - 128) / 128;
      sum += v * v;
    }
    onLevel?.(Math.min(1, Math.sqrt(sum / data.length) * 4));
    raf = requestAnimationFrame(tick);
  };
  return new Promise<void>((resolve) => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      onLevel?.(0);
      try {
        src.disconnect();
        an.disconnect();
      } catch {
        /* already disconnected */
      }
      if (current?.src === src) current = null;
      resolve();
    };
    src.onended = end;
    current = {
      src,
      stop: () => {
        try {
          src.stop();
        } catch {
          /* not started */
        }
        end();
      },
    };
    src.start();
    onStart?.(buf.duration);
    if (onLevel) raf = requestAnimationFrame(tick);
  });
}

export function base64ToBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Short two-tone "ready" beep, generated (no file, no credits). */
export function beep(): Promise<void> {
  try {
    const a = ac();
    const t = a.currentTime;
    const g = a.createGain();
    g.connect(a.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    [880, 1320].forEach((f, i) => {
      const o = a.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t + i * 0.09);
      o.connect(g);
      o.start(t + i * 0.09);
      o.stop(t + 0.1 + i * 0.09);
    });
    return new Promise((r) => setTimeout(r, 260));
  } catch {
    return Promise.resolve();
  }
}

const clipCache = new Map<string, ArrayBuffer | null>();

/** Static pre-generated clip from /public/soundbox (optional: missing files are skipped silently). */
export async function playClip(name: string, onLevel?: (l: number) => void): Promise<boolean> {
  if (!clipCache.has(name)) {
    try {
      const r = await fetch(`/soundbox/${name}.wav`);
      clipCache.set(name, r.ok ? await r.arrayBuffer() : null);
    } catch {
      clipCache.set(name, null);
    }
  }
  const bytes = clipCache.get(name);
  if (!bytes) return false;
  await playBytes(bytes, onLevel);
  return true;
}
