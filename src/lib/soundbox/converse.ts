/**
 * One Soundbox voice turn (SOUNDBOX.md §4.4), text in → spoken text out.
 * Order: a waiting yes/no → deterministic answers (no AI) → the agent with the voice prompt.
 * Returns the steps it took so the simulator can draw the pipeline.
 */
import type { Db } from "../db/client";
import { getOpenPending, loadSnapshot, saveConversationTurn } from "../db/queries";
import { applyChoice, type PendingRow } from "../agent/actions";
import { runAgent } from "../agent/run";
import { buildContext } from "../analytics/recommendations";
import { buildReport } from "../reports/build";
import { attachmentLinks } from "../server/artifacts";
import { buildInsights, parseVoiceChoice, spokenGreeting, spokenKhata, spokenMenu, spokenReport, spokenStock, spokenSuppliers, toSpoken, voiceIntent, type Insight, type VoiceIntent } from "./voice";

export type Route = "greet" | "confirm" | "cancel" | "no_pending" | VoiceIntent | "readonly" | "no_ai";

export interface TurnResult {
  route: Route;
  /** reply as the app would show it (may contain light formatting) */
  replyText: string;
  /** what the Soundbox says */
  spokenText: string;
  /** tools the agent ran, in order (empty for deterministic answers) */
  tools: string[];
  awaitingConfirmation: boolean;
  links: { kind: string; url: string }[];
  thinkMs: number;
  /** greeting only: the insights it spoke about */
  insights?: Insight[];
}

export interface TurnOpts {
  now: Date;
  /** landing page with SOUNDBOX_LANDING_READONLY=true: show the confirmation, but never apply it */
  readonly?: boolean;
}

export async function voiceTurn(db: Db, merchantId: string, text: string, opts: TurnOpts): Promise<TurnResult> {
  const t0 = Date.now();
  const done = async (r: Omit<TurnResult, "awaitingConfirmation" | "thinkMs" | "spokenText"> & { spokenText?: string }): Promise<TurnResult> => {
    const spokenText = r.spokenText ?? toSpoken(r.replyText);
    // the agent saves its own turns; save the rest too so its history is what really happened
    // (otherwise it sees "Maggi ke 20 packet aaye?" still unanswered and proposes it again)
    if (r.route !== "agent") await saveConversationTurn(db, merchantId, "voice", [{ role: "user", content: text }, { role: "assistant", content: spokenText }]);
    return { ...r, spokenText, awaitingConfirmation: Boolean(await getOpenPending(db, merchantId, opts.now)), thinkMs: Date.now() - t0 };
  };

  // 1. "haan" / "nahi" answers a waiting confirmation
  const choice = parseVoiceChoice(text);
  if (choice) {
    const row = (await getOpenPending(db, merchantId, opts.now)) as PendingRow | undefined;
    if (!row) return done({ route: "no_pending", replyText: "Abhi koi kaam confirm karne ke liye baaki nahi hai. Boliye, kya jaanna hai?", tools: [], links: [] });
    if (opts.readonly && choice === 1) {
      await applyChoice(db, merchantId, row, 2);
      return done({ route: "readonly", replyText: "Yeh demo hai, isliye yahan se badlav save nahi hota. Asli dukaan mein haan bolte hi stock ya khata update ho jaata hai.", tools: [], links: [] });
    }
    const reply = (await applyChoice(db, merchantId, row, choice)) ?? "Yeh kaam pehle hi ho chuka hai.";
    return done({ route: choice === 1 ? "confirm" : "cancel", replyText: reply, tools: [], links: [] });
  }

  // the owner asked something else instead of answering haan/nahi: drop the waiting action, like a person would
  const stale = (await getOpenPending(db, merchantId, opts.now)) as PendingRow | undefined;
  if (stale) await applyChoice(db, merchantId, stale, 2);

  // 2. the common "show me" asks: answered from the same report data as the dashboard, no AI call
  const intent = voiceIntent(text);
  if (intent !== "agent") {
    const snap = await loadSnapshot(db, merchantId, { now: opts.now });
    const ctx = buildContext(snap);
    const today = buildReport(snap, { period: "today", ctx });
    const spoken =
      intent === "menu" ? spokenMenu(today) : intent === "report" ? spokenReport(today) : intent === "stock" ? spokenStock(today) : intent === "khata" ? spokenKhata(ctx) : spokenSuppliers(today);
    return done({ route: intent, replyText: spoken, spokenText: spoken, tools: [], links: [] });
  }

  // 3. anything else: the agent, with the short spoken-reply prompt
  if (!process.env.ANTHROPIC_API_KEY)
    return done({ route: "no_ai", replyText: "Abhi main sirf aaj ki sale, stock, udhaar aur supplier payment bata sakta hoon. Inme se kuch poochiye.", tools: [], links: [] });
  const tools: string[] = [];
  const out = await runAgent(db, merchantId, text, "voice", { now: opts.now, readonly: opts.readonly, onTool: (n) => tools.push(n) });
  const links = out.attachments.length ? await attachmentLinks(db, merchantId, out.attachments) : [];
  return done({ route: "agent", replyText: out.text, tools, links });
}

/** Session start: namaste + two random insights. Pure data, no AI call. */
export async function greetTurn(db: Db, merchantId: string, now: Date, rand: () => number = Math.random): Promise<TurnResult> {
  const t0 = Date.now();
  const snap = await loadSnapshot(db, merchantId, { now });
  const ctx = buildContext(snap);
  const today = buildReport(snap, { period: "today", ctx });
  const insights = buildInsights(today, ctx);
  const g = spokenGreeting(insights, rand);
  const picked = insights.filter((i) => g.picked.includes(i.id));
  await saveConversationTurn(db, merchantId, "voice", [{ role: "assistant", content: g.text }]);
  return { route: "greet", replyText: g.text, spokenText: g.text, tools: [], awaitingConfirmation: false, links: [], thinkMs: Date.now() - t0, insights: picked };
}

/** Cards for the Voice Saathi page: everything worth knowing today, no AI. */
export async function todayInsights(db: Db, merchantId: string, now: Date): Promise<Insight[]> {
  const snap = await loadSnapshot(db, merchantId, { now });
  const ctx = buildContext(snap);
  return buildInsights(buildReport(snap, { period: "today", ctx }), ctx);
}
