import type { ReactNode } from "react";

/** Saathi replies use WhatsApp-style text: *bold*, "- " bullets, blank lines between paragraphs. */
const CONFIRM_TAIL = /\n*\*1\*\s*=[^\n]*\n\*2\*\s*=[^\n]*\s*$/;

/** True when a reply ends with the "1 = yes, 2 = no" prompt that waits for an answer. */
export function asksConfirmation(text: string): boolean {
  return CONFIRM_TAIL.test(text);
}

export function stripConfirmPrompt(text: string): string {
  return text.replace(CONFIRM_TAIL, "").trim();
}

function inline(s: string): ReactNode[] {
  return s.split(/(\*[^*\n]+\*)/g).map((part, i) =>
    part.length > 2 && part.startsWith("*") && part.endsWith("*") ? <strong key={i}>{part.slice(1, -1)}</strong> : part,
  );
}

const BULLET = /^\s*(?:[-•]|\d+\.)\s+/;

export function MessageText({ text }: { text: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.split("\n").filter((l) => l.trim() !== ""))
    .filter((b) => b.length > 0);
  return (
    <div className="sc-text">
      {blocks.map((lines, i) =>
        lines.every((l) => BULLET.test(l)) ? (
          <ul key={i}>
            {lines.map((l, j) => (
              <li key={j}>{inline(l.replace(BULLET, ""))}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {inline(l)}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
