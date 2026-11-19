/**
 * Soundbox voice mode (SOUNDBOX.md §4). Pure helpers: spoken yes/no, the few deterministic voice intents
 * (no AI call, no cost), short spoken answers built from the same report data the dashboard uses,
 * and a cleaner that turns WhatsApp-style text into something text-to-speech reads naturally.
 */
import type { ReportData } from "../reports/build";
import type { RecContext } from "../analytics/recommendations";
import { daysLabel, num } from "../format";

/** lowercase, drop punctuation (incl. Devanagari danda), collapse spaces */
export function normalise(t: string): string {
  return t
    .toLowerCase()
    .replace(/[।॥.,!?;:"'“”‘’()\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const YES = ["haan ji", "ji haan", "haan", "haa", "han", "ha", "yes", "ok", "okay", "theek hai", "thik hai", "kar do", "kardo", "karo", "हाँ", "हां", "जी हाँ", "जी हां", "ठीक है", "कर दो"];
const NO = ["nahi", "nahin", "nai", "na", "no", "mat karo", "rehne do", "rahne do", "cancel", "नहीं", "ना", "मत करो", "रहने दो"];

/** Spoken yes/no. Matches a whole short reply, or a reply that starts with a yes/no word ("haan kar do bhai"). */
export function parseVoiceChoice(raw: string): 1 | 2 | null {
  const t = normalise(raw);
  if (!t) return null;
  const words = t.split(" ");
  // long sentences are questions or commands, not answers ("nahi pata maggi kitna hai…")
  if (words.length > 5) return null;
  const starts = (list: string[]) => list.some((w) => t === w || t.startsWith(`${w} `));
  // check NO first: "na" must not be read as yes, and "nahi" starts with "na"
  if (starts(NO)) return 2;
  if (starts(YES)) return 1;
  return null;
}

export type VoiceIntent = "menu" | "report" | "stock" | "khata" | "suppliers" | "agent";

const TIME_WORDS = /\b(kal|parso|hafte|hafta|week|mahine|mahina|month|saal|year|pichle|pichhle|last)\b|कल|हफ्ते|महीने|पिछले/;

/**
 * Narrow on purpose: only the common "show me" asks are answered without the AI.
 * Anything with another time word, a number, or a specific item/customer goes to the agent.
 */
export function voiceIntent(raw: string): VoiceIntent {
  const t = normalise(raw);
  if (!t) return "menu";
  if (/^(hi|hii+|hello|hey|namaste|namaskar|menu|help|नमस्ते|नमस्कार)( ji)?$/.test(t) || /kya kar sakte|क्या कर सकते/.test(t)) return "menu";
  if (/\d/.test(t) || TIME_WORDS.test(t)) return "agent";
  if (/\b(aaj|aj)\b|आज/.test(t) && /(sale|sales|bikri|report|hisaab|hisab|kamai|बिक्री|बिकरी|हिसाब|कमाई|रिपोर्ट|सेल)/.test(t)) return "report";
  if (/(kya|kaun ?sa|kaunsa|kon ?sa) (maal |saman |item )?khatam|kya mangwana|kya order|stock (dikhao|batao|kaisa)|क्या (माल |सामान )?(खत्म|ख़त्म)|कौन ?सा .*(खत्म|ख़त्म)|क्या मंगवाना|स्टॉक (दिखाओ|बताओ)/.test(t)) return "stock";
  if (/(kitne|kiske|kis kis|kin) .*(udhaar|udhar|baaki|baki)|udhaar (list|batao|dikhao)|khata (batao|dikhao)|(किसका|किसके|किस किस|कितने) .*(उधार|उधर|बाकी|बाक़ी)/.test(t)) return "khata";
  if (/(supplier|vendor|सप्लायर|वेंडर).*(kitna|payment|dena|baaki|baki|कितना|देना|बाकी|पेमेंट)|kisko kitna dena|किसको कितना देना/.test(t)) return "suppliers";
  return "agent";
}

/* ---------------- money and counts said aloud ---------------- */

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** 1845000 paise → "18,450 rupaye" (rounded to the rupee, Indian commas). */
export function spokenRupees(paise: number): string {
  return `${inr.format(Math.round(Math.abs(paise) / 100))} rupaye`;
}

/* ---------------- short spoken answers (no AI) ---------------- */

export const MENU_SPOKEN =
  "Main aapki dukaan ka hisaab rakhta hoon. Aap pooch sakte hain: aaj ki sale, kya khatam hone wala hai, kiska udhaar baaki hai, supplier ko kitna dena hai. Ya stock update kijiye, jaise Maggi ke 20 packet aaye. Boliye.";

export function spokenMenu(today: ReportData): string {
  const s = today.sales;
  const lead = s.bills > 0 ? `Aaj ab tak ${spokenRupees(s.totalPaise)} ki sale hui hai, ${num(s.bills)} bill. ` : "";
  return lead + MENU_SPOKEN;
}

export function spokenReport(today: ReportData): string {
  const s = today.sales;
  const out: string[] = [];
  if (s.bills === 0) out.push("Aaj abhi tak koi sale record nahi hui.");
  else out.push(`Aaj ab tak ${spokenRupees(s.totalPaise)} ki sale hui, ${num(s.bills)} bill. UPI se ${spokenRupees(s.upiPaise)}, cash ${spokenRupees(s.cashPaise)}.`);
  if (s.changePct !== null && s.bills > 0) {
    const p = Math.round(Math.abs(s.changePct));
    if (p >= 1) out.push(`Pichle hafte isi din se ${p} percent ${s.changePct > 0 ? "zyada" : "kam"}.`);
  }
  if (today.profit.netPaise !== 0 && s.bills > 0) out.push(`Kharche ke baad munafa ${today.profit.netPaise < 0 ? "minus " : ""}${spokenRupees(today.profit.netPaise)}.`);
  const top = today.recommendations[0];
  if (top) out.push(`Sabse zaroori: ${top.title}.`);
  return toSpoken(out.join(" "), 420);
}

export function spokenStock(today: ReportData): string {
  const { runningOut, out } = today.stockAlerts;
  const parts: string[] = [];
  if (out.length) parts.push(`${listNames(out.map((f) => f.name), 3)} khatam ho chuka hai.`);
  if (runningOut.length) {
    const lines = runningOut.slice(0, 3).map((f) => `${f.name} ${daysLabel(f.daysToStockout)} mein`);
    parts.push(`Jaldi khatam hone wala: ${listNames(lines, 3)}.`);
  }
  if (!parts.length) return "Abhi koi maal khatam hone wala nahi hai. Stock theek hai.";
  parts.push("Order list dashboard aur WhatsApp pe hai.");
  return parts.join(" ");
}

export function spokenKhata(ctx: RecContext): string {
  const k = ctx.khata;
  const open = k.accounts.filter((a) => a.outstandingPaise > 0);
  if (!open.length) return "Kisi ka udhaar baaki nahi hai.";
  const out = [`${num(open.length)} logon ka udhaar baaki hai, kul ${spokenRupees(k.totalOutstandingPaise)}.`];
  const red = open.filter((a) => a.band === "red");
  if (red.length) {
    const w = red.slice(0, 2).map((a) => `${a.name} pe ${spokenRupees(a.outstandingPaise)}, ${num(a.oldestUnpaidDays)} din se`);
    out.push(`Dhyaan dijiye: ${w.join(", aur ")}. Inko naya udhaar mat dijiye.`);
  }
  return out.join(" ");
}

export function spokenSuppliers(today: ReportData): string {
  const due = today.payablesDue;
  if (!due.length) return "Kisi supplier ka payment abhi baaki nahi hai.";
  const lines = due.slice(0, 3).map((p) => {
    const when = p.dueInDays < 0 ? `${-p.dueInDays} din late` : p.dueInDays === 0 ? "aaj due" : p.dueInDays === 1 ? "kal due" : `${p.dueInDays} din mein due`;
    return `${p.vendorName} ko ${spokenRupees(p.amountPaise)}, ${when}`;
  });
  return `${lines.join(". ")}.`;
}

function listNames(xs: string[], max: number): string {
  const shown = xs.slice(0, max);
  const more = xs.length - shown.length;
  if (shown.length <= 1) return shown.join("");
  const head = `${shown.slice(0, -1).join(", ")} aur ${shown[shown.length - 1]}`;
  return more > 0 ? `${head}, aur ${more} aur items` : head;
}

/* ---------------- text → speakable text ---------------- */

// pictographs, dingbats, keycaps, variation selectors, zero-width joiner
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{20E3}\u{200D}]/gu;

/**
 * WhatsApp/markdown reply → plain sentences for TTS: no markdown, emoji, links or menu hints;
 * "₹18,450" → "18,450 rupaye", "%" → " percent". Cut at a sentence end before maxChars.
 */
export function toSpoken(text: string, maxChars = 350): string {
  let t = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/menu ke liye[^.\n]*/gi, "")
    .replace(EMOJI, "")
    .replace(/[*_~`#>]/g, "")
    .replace(/₹\s?(-?[\d,]+(?:\.\d+)?)/g, (_m, n: string) => `${n.replace(/\.\d+$/, "")} rupaye`)
    .replace(/\brs\.?\s?([\d,]+)/gi, "$1 rupaye")
    .replace(/(\d)\s?%/g, "$1 percent")
    .replace(/\s[×x]\s?(\d+)/g, " $1")
    .replace(/[−–—]/g, ", ")
    .replace(/^\s*(?:[-•·]|\d+[.)])\s*/gm, "")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/([.?!]),/g, "$1")
    .replace(/,\s*\./g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[\s.,]+/, "")
    .trim();
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "), cut.lastIndexOf("। "));
  t = end > maxChars * 0.4 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}.`;
  return t.trim();
}

/** TTS language for the reply: English only when the speech-to-text said the owner spoke English. */
export function replyLanguage(sttLanguage: string | null | undefined): "hi-IN" | "en-IN" {
  return sttLanguage === "en-IN" ? "en-IN" : "hi-IN";
}

/* ---------------- insights + greeting (no AI) ---------------- */

export type InsightTone = "risk" | "stock" | "money" | "good" | "info";

export interface Insight {
  id: string;
  tone: InsightTone;
  /** short tag for the card */
  label: string;
  /** one line for the card, ₹ formatted */
  title: string;
  /** one sentence for the voice */
  spoken: string;
  /** follow-up question the card asks when tapped */
  ask: string;
}

const inrUi = (paise: number) => `₹${inr.format(Math.round(Math.abs(paise) / 100))}`;

/** Things worth saying today, riskiest first. Every number comes from the report/context code computed. */
export function buildInsights(today: ReportData, ctx: RecContext): Insight[] {
  const out: Insight[] = [];
  for (const a of ctx.khata.accounts.filter((x) => x.band === "red" && x.outstandingPaise > 0).slice(0, 2))
    out.push({
      id: `khata-${a.customerId}`,
      tone: "risk",
      label: "High risk udhaar",
      title: `${a.name} pe ${inrUi(a.outstandingPaise)}, ${num(a.oldestUnpaidDays)} din se`,
      spoken: `${a.name} pe ${spokenRupees(a.outstandingPaise)} ka udhaar ${num(a.oldestUnpaidDays)} din se baaki hai, inhe naya udhaar mat dijiye`,
      ask: `${a.name} ka udhaar kitna hai?`,
    });
  for (const f of today.stockAlerts.out.slice(0, 1))
    out.push({ id: `out-${f.productId}`, tone: "stock", label: "Stock khatam", title: `${f.name} khatam hai`, spoken: `${f.name} ka stock khatam ho chuka hai`, ask: "Kya order karna hai?" });
  for (const f of today.stockAlerts.runningOut.slice(0, 2))
    out.push({
      id: `low-${f.productId}`,
      tone: "stock",
      label: "Jaldi khatam",
      title: `${f.name}: ${daysLabel(f.daysToStockout)} ka stock`,
      spoken: `${f.name} lagbhag ${daysLabel(f.daysToStockout)} mein khatam ho jayega`,
      ask: `${f.name} kab khatam hoga?`,
    });
  for (const p of today.payablesDue.filter((x) => x.dueInDays <= 2).slice(0, 2)) {
    const when = p.dueInDays < 0 ? `${-p.dueInDays} din late` : p.dueInDays === 0 ? "aaj due" : p.dueInDays === 1 ? "kal due" : `${p.dueInDays} din mein due`;
    out.push({
      id: `pay-${p.purchaseId}`,
      tone: "money",
      label: "Supplier payment",
      title: `${p.vendorName}: ${inrUi(p.amountPaise)}, ${when}`,
      spoken: `${p.vendorName} ko ${spokenRupees(p.amountPaise)} dene hain, ${when}`,
      ask: "Supplier ko kitna dena hai?",
    });
  }
  if (today.lostSales.requests > 0 && today.lostSales.top)
    out.push({
      id: "lost",
      tone: "stock",
      label: "Lost sales",
      title: `${num(today.lostSales.requests)} grahak khaali haath gaye`,
      spoken: `aaj ${num(today.lostSales.requests)} grahak ne aisa saamaan maanga jo stock mein nahi tha, sabse zyada ${today.lostSales.top.name}`,
      ask: "Lost sales kitni hui?",
    });
  const s = today.sales;
  if (s.bills > 0) {
    const ch = s.changePct !== null && Math.round(Math.abs(s.changePct)) >= 1 ? Math.round(s.changePct) : null;
    out.push({
      id: "sales",
      tone: "good",
      label: "Aaj ki sale",
      title: `${inrUi(s.totalPaise)} · ${num(s.bills)} bill${ch !== null ? ` · ${ch > 0 ? "+" : ""}${ch}%` : ""}`,
      spoken: `aaj ab tak ${spokenRupees(s.totalPaise)} ki sale hui hai${ch !== null ? `, pichle hafte isi din se ${Math.abs(ch)} percent ${ch > 0 ? "zyada" : "kam"}` : ""}`,
      ask: "Aaj ki sale kitni hui?",
    });
  }
  const rec = today.recommendations[0];
  if (rec) out.push({ id: `rec-${rec.id}`, tone: "info", label: "Aaj ka suggestion", title: rec.title, spoken: toSpoken(rec.title, 160).replace(/\.$/, ""), ask: "Aaj kya karna chahiye?" });
  return out;
}

/**
 * Opening line when the owner starts a session: namaste, today's sales if any, then two insights picked at
 * random from the important ones (risk, stock, money first), so the greeting is different each time.
 */
export function spokenGreeting(insights: Insight[], rand: () => number = Math.random): { text: string; picked: string[] } {
  const important = insights.filter((i) => i.tone !== "good" && i.tone !== "info");
  const pool = important.length >= 2 ? important : insights.filter((i) => i.tone !== "good");
  const picked = [...pool]
    .map((i) => ({ i, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 2)
    .map((x) => x.i);
  const sales = insights.find((i) => i.tone === "good");
  const parts = ["Namaste!"];
  if (sales) parts.push(`${cap(sales.spoken)}.`);
  if (picked.length === 1) parts.push(`Ek zaroori baat: ${picked[0]!.spoken}.`);
  if (picked.length === 2) parts.push(`Do zaroori baatein. Pehli, ${picked[0]!.spoken}. Doosri, ${picked[1]!.spoken}.`);
  parts.push("Boliye, kya jaanna hai?");
  return { text: parts.join(" "), picked: picked.map((p) => p.id) };
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
