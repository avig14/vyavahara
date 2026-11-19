/**
 * What the bot answers when the owner writes to it. A numbered menu and the common asks are deterministic
 * (no AI call, no cost). Anything else goes to the same agent the dashboard chat uses.
 */
import type { Db } from "../db/client";
import { loadSnapshot, startWaMessage, markWaSent, markWaFailed } from "../db/queries";
import { buildContext } from "../analytics/recommendations";
import { buildReport } from "../reports/build";
import { reportText } from "../reports/text";
import { resolveChoice } from "../agent/actions";
import { runAgent } from "../agent/run";
import { mintReportLink, baseUrl } from "../server/artifacts";
import { rupees } from "../format";
import { sendLongText, WaError, type WaConfig } from "./cloud";
import { stockText, whatsappDigest } from "./digest";

export const MENU = [
  "*Namaste! Main Vyavahāra hoon* 🙏",
  "Number bhejo:",
  "1️⃣ Aaj ka poora report",
  "2️⃣ Stock — kya mangwana hai",
  "3️⃣ Udhaar (khata)",
  "4️⃣ Supplier payments",
  "5️⃣ PDF report",
  "",
  "Ya seedha poochho, jaise _\"aaj kitni sale hui?\"_",
].join("\n");

const GREETING = /^(hi|hii+|hello|hey|namaste|namaskar|menu|help|start|0)\b/i;

export type Intent = "menu" | "report" | "stock" | "khata" | "suppliers" | "pdf" | "agent";

/** Pure: which canned answer (if any) does this message ask for. */
export function intentOf(raw: string | null, reply: string | null = null): Intent {
  const t = (reply ?? raw ?? "").trim().toLowerCase();
  if (!t) return "menu";
  if (GREETING.test(t)) return "menu";
  if (t === "1" || t === "report") return "report";
  if (t === "2" || t === "stock") return "stock";
  if (t === "3" || t === "khata" || t === "udhaar") return "khata";
  if (t === "4" || t === "supplier" || t === "suppliers") return "suppliers";
  if (t === "5" || t === "pdf") return "pdf";
  return "agent";
}

export async function answerFor(db: Db, merchantId: string, text: string | null, reply: string | null, now: Date): Promise<string> {
  const intent = intentOf(text, reply);
  // a waiting 1/2 confirmation wins over the menu digit, so "1" confirms instead of opening the report
  if (text && (intent === "report" || intent === "stock")) {
    const c = await resolveChoice(db, merchantId, text, now);
    if (c.handled) return c.reply;
  }
  if (intent === "menu") return MENU;
  if (intent === "agent") {
    if (!text) return "Abhi sirf text samajh paata hoon. *Hi* likho menu ke liye.";
    if (!process.env.ANTHROPIC_API_KEY) return "Ab free sawal ka jawab nahi de sakta. Menu ke liye *Hi* likho.";
    const c = await resolveChoice(db, merchantId, text, now);
    if (c.handled) return c.reply;
    return (await runAgent(db, merchantId, text, "wa", { now })).text;
  }
  if (intent === "pdf") {
    if (!baseUrl()) return "PDF link abhi nahi ban sakta (APP_BASE_URL set nahi hai).";
    return `📄 Aaj ka PDF (7 din tak chalega):\n${await mintReportLink(db, merchantId, { period: "today" })}`;
  }
  const snap = await loadSnapshot(db, merchantId, { now });
  const ctx = buildContext(snap);
  if (intent === "stock") return stockText(snap, ctx);
  const rep = buildReport(snap, { period: "today", ctx });
  if (intent === "khata") {
    const k = rep.khata;
    if (k.totalDuePaise <= 0) return "📒 Koi udhaar baaki nahi hai.";
    return [`📒 *Udhaar baaki ${rupees(k.totalDuePaise)}*`, ...k.red.slice(0, 5).map((a) => `🔴 ${a.name} ${rupees(a.outstandingPaise)} (${a.oldestUnpaidDays} din)`)].join("\n");
  }
  if (intent === "suppliers") {
    if (!rep.payablesDue.length) return "🧾 Koi supplier payment baaki nahi hai.";
    return ["🧾 *Supplier payments*", ...rep.payablesDue.slice(0, 6).map((p) => `• ${p.vendorName} ${rupees(p.amountPaise)} — ${p.dueInDays < 0 ? `${-p.dueInDays} din late` : p.dueInDays === 0 ? "aaj due" : `${p.dueInDays} din mein`}`)].join("\n");
  }
  // "report"
  return whatsappDigest(snap, { ctx, today: rep }).text || reportText(rep);
}

/** Answer one inbound message and record the reply. Never throws: a failed reply is logged on the dashboard row. */
export async function replyTo(db: Db, merchantId: string, to: string, text: string | null, reply: string | null, cfg: WaConfig, now = new Date(), f: typeof fetch = fetch): Promise<void> {
  let body: string;
  try {
    body = await answerFor(db, merchantId, text, reply, now);
  } catch (e) {
    console.error("[wa] answer failed", e instanceof Error ? e.message : "unknown");
    body = "Kuch gadbad ho gayi. Thodi der baad dobara try karo.";
  }
  const id = await startWaMessage(db, merchantId, intentOf(text, reply) === "menu" ? "menu" : "reply", body.split("\n")[0]);
  try {
    await markWaSent(db, id, (await sendLongText(to, body, cfg, f)).wamid);
  } catch (e) {
    await markWaFailed(db, id, e instanceof WaError ? e.code : null, e instanceof WaError ? e.message : "Unexpected error");
  }
}
