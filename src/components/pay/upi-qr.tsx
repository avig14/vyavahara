"use client";

import { useMemo } from "react";
import { create } from "qrcode";

const QUIET = 4; // modules of white around the code, the QR spec minimum

interface Drawn {
  d: string;
  size: number;
}

function draw(value: string): Drawn | null {
  try {
    const { modules } = create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let r = 0; r < modules.size; r++) {
      for (let c = 0; c < modules.size; c++) {
        if (modules.get(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
      }
    }
    return { d, size: modules.size + QUIET * 2 };
  } catch {
    return null;
  }
}

export interface UpiQrProps {
  /** the upi:// link; the QR encodes exactly this */
  value: string;
  /** the server's own rendering (PNG data URL), used only if drawing here fails */
  fallbackSrc?: string;
  label: string;
}

/** The UPI link as an inline SVG QR: one path of black modules on a white square, in token colours. */
export function UpiQr({ value, fallbackSrc, label }: UpiQrProps) {
  const qr = useMemo(() => draw(value), [value]);

  if (!qr) {
    // eslint-disable-next-line @next/next/no-img-element -- a data URL from our own API, nothing to optimise
    return fallbackSrc ? <img className="pay-qr" src={fallbackSrc} width={256} height={256} alt={label} /> : null;
  }
  return (
    <svg className="pay-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={qr.size} height={qr.size} className="pay-qr-bg" />
      <path d={qr.d} className="pay-qr-ink" />
    </svg>
  );
}
