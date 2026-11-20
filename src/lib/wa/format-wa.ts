/**
 * WhatsApp message formatting for the on-screen preview: *bold*, _italic_ and links, as WhatsApp shows them.
 * Pure and safe: it returns tokens, never HTML, so a message can never inject markup.
 */
export type WaToken = { kind: "text" | "bold" | "italic" | "link"; text: string };

const RE = /(\*[^*\n]+\*)|(_[^_\n]+_)|(https?:\/\/[^\s<>"')]+)/g;

export function tokenizeWa(line: string): WaToken[] {
  const out: WaToken[] = [];
  let last = 0;
  for (const m of line.matchAll(RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: "text", text: line.slice(last, i) });
    if (m[1]) out.push({ kind: "bold", text: m[1].slice(1, -1) });
    else if (m[2]) out.push({ kind: "italic", text: m[2].slice(1, -1) });
    else out.push({ kind: "link", text: m[3] });
    last = i + m[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}

/** A message as lines of tokens (a blank line stays a blank line). */
export const formatWa = (text: string): WaToken[][] => text.split("\n").map(tokenizeWa);
