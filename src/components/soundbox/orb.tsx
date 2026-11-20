"use client";

/**
 * The Voice Saathi orb: 72 radial bars around a glowing core. Bars stretch with the real mic level while
 * listening and with the Soundbox's own voice while speaking; while thinking an arc spins around it; at rest
 * the bars breathe in a slow wave. Motion is transform/opacity only, driven by one CSS variable (--lvl).
 */
import type { CSSProperties } from "react";
import type { Phase } from "./use-voice-session";

const BARS = 72;
const C = 160;
const R_IN = 92;
// deterministic per-bar "personality" so the ring looks organic, identical on server and browser
const SHAPE = Array.from({ length: BARS }, (_, i) => {
  const v = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.43));
  return Math.round(v * 1000) / 1000;
});

const ICON: Record<Phase, string> = {
  off: "Shuru karein",
  idle: "Taiyaar",
  listening: "Sun raha hoon",
  thinking: "Soch raha hoon",
  speaking: "Bol raha hoon",
};

export function Orb({ phase, level, onTap, label }: { phase: Phase; level: number; onTap: () => void; label: string }) {
  return (
    <button type="button" className="vs-orb" data-phase={phase} style={{ "--lvl": level.toFixed(3) } as CSSProperties} onClick={onTap} aria-label={label}>
      <span className="vs-orb-glow" aria-hidden="true" />
      <svg viewBox="0 0 320 320" className="vs-orb-svg" aria-hidden="true">
        <circle className="vs-orb-track" cx={C} cy={C} r={R_IN + 44} />
        <circle className="vs-orb-arc" cx={C} cy={C} r={R_IN + 44} pathLength={100} />
        <g className="vs-bars">
          {SHAPE.map((k, i) => (
            <g key={i} transform={`rotate(${(i * 360) / BARS} ${C} ${C})`}>
              <rect className="vs-bar" x={C - 2} y={C - R_IN - 30} width={4} height={30} rx={2} style={{ "--k": k, "--i": i } as CSSProperties} />
            </g>
          ))}
        </g>
        <circle className="vs-core-ring" cx={C} cy={C} r={R_IN - 14} />
        <circle className="vs-core" cx={C} cy={C} r={R_IN - 24} />
      </svg>
      <span className="vs-orb-center">
        {phase === "listening" ? <MicIcon /> : phase === "thinking" ? <Dots /> : phase === "speaking" ? <WaveIcon /> : phase === "off" ? <PowerIcon /> : <MicIcon />}
        <span className="vs-orb-word">{ICON[phase]}</span>
      </span>
    </button>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3v8M7.1 6.2a7.5 7.5 0 109.8 0" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="vs-wave">
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    </svg>
  );
}

function Dots() {
  return (
    <span className="vs-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
