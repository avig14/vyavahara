/** Round a max up to a clean tick step so gridlines land on readable numbers. */
export function niceMax(max: number, ticks = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: 1, step: 1 / ticks };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return { max: step * Math.ceil(max / step), step };
}

export function tickValues(max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = 0; v <= max + step / 1000; v += step) out.push(v);
  return out;
}

/** Indices to label on a category axis so labels never collide: every `k`-th, plus the last when there is room. */
export function labelIndices(n: number, width: number, minGap: number): Set<number> {
  const out = new Set<number>();
  if (n === 0) return out;
  const fit = Math.max(1, Math.floor(width / minGap));
  const every = Math.max(1, Math.ceil(n / fit));
  let lastShown = 0;
  for (let i = 0; i < n; i += every) {
    out.add(i);
    lastShown = i;
  }
  if (n - 1 !== lastShown && n - 1 - lastShown >= every * 0.6) out.add(n - 1);
  return out;
}

export function linePath(pts: readonly (readonly [number, number])[]): string {
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

/** Compact tick label: 12k, 1.2L (lakh), 3Cr is how an owner reads rupees, but units are the caller's job; this is plain. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return `${+(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${+(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  return `${+n.toFixed(1)}`;
}

/** "₹1.2L" style axis label from paise; full amounts belong to `rupees()` in src/lib/format.ts. */
export function compactRupees(paise: number): string {
  return `${paise < 0 ? "-" : ""}₹${compact(Math.abs(paise) / 100)}`;
}
