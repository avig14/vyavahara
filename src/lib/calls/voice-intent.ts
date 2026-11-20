/** Voice Saathi: "Sharma ji ko reminder call karo". Pure parsing, no AI. */

export interface CallableAccount {
  customerId: string;
  name: string;
  outstandingPaise: number;
  oldestUnpaidDays: number;
}

export type CallRequest =
  | { kind: "none" }
  | { kind: "nameless" }
  | { kind: "one"; account: CallableAccount }
  | { kind: "ambiguous"; names: string[] };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "call", "phone", "reminder", "yaad dilao", Hindi spellings. Must also name a person or ask generally. */
const CALL_WORDS = /\b(call|phone|fone|reminder|remind|yaad ?dila\w*)\b|कॉल|फोन|फ़ोन|रिमाइंडर|याद ?दिला/;
const FILLER = new Set(["ji", "ko", "ka", "ki", "se", "call", "phone", "fone", "karo", "kar", "do", "dena", "lagao", "lagaao", "reminder", "remind", "yaad", "dilao", "dilana", "ek", "please", "pls", "customer", "bhai", "madam", "sir"]);

/** Cheap pre-check so ordinary voice turns do not load the snapshot for this. */
export const mentionsCall = (raw: string) => CALL_WORDS.test(norm(raw));

export function parseCallRequest(raw: string, accounts: readonly CallableAccount[]): CallRequest {
  const t = norm(raw);
  if (!t || !CALL_WORDS.test(t)) return { kind: "none" };
  const words = t.split(" ").filter((w) => w.length >= 3 && !FILLER.has(w));
  const hits = accounts.filter((a) => {
    const parts = norm(a.name).split(" ").filter((w) => w.length >= 3 && !FILLER.has(w));
    return parts.some((p) => words.includes(p));
  });
  if (hits.length === 1) return { kind: "one", account: hits[0] };
  if (hits.length > 1) return { kind: "ambiguous", names: hits.slice(0, 3).map((h) => h.name) };
  return /(karo|kardo|lagao|lagaao|reminder|yaad|करो|लगाओ)/.test(t) ? { kind: "nameless" } : { kind: "none" };
}
