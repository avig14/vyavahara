/**
 * Dashboard chat preview ("WhatsApp-style"): the owner's message runs through the SAME menu tree, flows and agent
 * the real bot uses, but nothing is saved and no provider is called.
 *  - The conversation position lives in the browser (`PreviewState`), never in wa_sessions, so a preview cannot
 *    disturb a real chat (a half-finished "pick a vendor" step, a queued alert, a pending 1/2 confirmation).
 *  - Every write (khata entry, stock change, purchase order, a 1/2 confirmation) is blocked and the owner is told so.
 *  - The agent runs with that same blocked store, no history and no saved turns.
 * Pure over a Snapshot, so it is cheap to test with no database.
 */
import type { Snapshot } from "../domain";
import { buildContext } from "../analytics/recommendations";
import { runAgentWith, type AgentResult } from "../agent/run";
import type { AgentStore } from "../agent/store";
import { handleAwaiting, type FlowEnv } from "../menu/flows";
import { isBack, isMenuWord, isModuleKey, mainMenu, menuEnv, moduleMenu, NAV, pdfRequest, renderLeaf, type Awaiting } from "../menu/menus";

export interface PreviewState {
  /** "" = main menu, "1".."5" = inside that module */
  path: string;
  /** what the bot is waiting for (a vendor number, "Suresh 300", two dates...) */
  awaiting: Awaiting | null;
}

export const PREVIEW_START: PreviewState = { path: "", awaiting: null };

export interface PreviewReply {
  parts: string[];
  state: PreviewState;
  /** what was shown, for the photo card and the tappable options: "menu", "module:3", "4.1", or null */
  shown: string | null;
}

export interface PreviewDeps {
  agentReady(): boolean;
  agent(snap: Snapshot, store: AgentStore, text: string): Promise<AgentResult>;
}

export const livePreviewDeps: PreviewDeps = {
  agentReady: () => Boolean(process.env.ANTHROPIC_API_KEY),
  agent: (snap, store, text) => runAgentWith({ snap, store, history: [], text }),
};

/** Thrown by the preview store so a flow that tries to write stops and the owner is told. */
export class PreviewBlocked extends Error {
  constructor() {
    super("preview: save nahi hota");
  }
}

const NOT_SAVED = `👀 *Preview mode:* yeh badlav save nahi hua. Asli bot mein yahi likhne par ho jaata.\n\n${NAV}`;

const blocked = async (): Promise<never> => {
  throw new PreviewBlocked();
};

/** Every write refuses. Reads never go through the store, they use the snapshot. */
export const previewStore: AgentStore = {
  addKhataEntry: blocked,
  addExpense: blocked,
  addCashSale: blocked,
  adjustStock: blocked,
  setCreditBlocked: blocked,
  setCreditLimit: blocked,
  createPurchaseOrder: blocked,
  payVendorBill: blocked,
  receiveBill: blocked,
  createPending: blocked,
  callCustomer: blocked,
};

const strings = (v: unknown): string[] | null => (Array.isArray(v) && v.length <= 50 && v.every((x) => typeof x === "string" && x.length <= 80) ? (v as string[]) : null);

/** The browser sends the state back, so treat it as untrusted: anything odd becomes "start over". */
export function cleanPreviewState(v: unknown): PreviewState {
  if (!v || typeof v !== "object") return PREVIEW_START;
  const o = v as { path?: unknown; awaiting?: unknown };
  const path = typeof o.path === "string" && isModuleKey(o.path) ? o.path : "";
  const a = o.awaiting;
  if (!a || typeof a !== "object" || typeof (a as { kind?: unknown }).kind !== "string") return { path, awaiting: null };
  const w = a as Record<string, unknown>;
  switch (w.kind) {
    case "custom_dates":
    case "udhaar_entry":
    case "stock_add":
    case "screenshot":
      return { path, awaiting: { kind: w.kind } };
    case "pick_po": {
      const ids = strings(w.vendorIds);
      return { path, awaiting: ids ? { kind: "pick_po", vendorIds: ids } : null };
    }
    case "pick_pay": {
      const ids = strings(w.purchaseIds);
      return { path, awaiting: ids ? { kind: "pick_pay", purchaseIds: ids } : null };
    }
    case "pick_reminder": {
      const ids = strings(w.customerIds);
      return { path, awaiting: ids ? { kind: "pick_reminder", customerIds: ids } : null };
    }
    default:
      return { path, awaiting: null }; // "alert" is never offered in a preview
  }
}

const PDF_NOTE = "📄 _Preview mein PDF nahi jaata. Asli bot mein report ki PDF file aati hai._";

export async function previewReply(snap: Snapshot, raw: string, stateIn: PreviewState, deps: PreviewDeps = livePreviewDeps): Promise<PreviewReply> {
  const state = cleanPreviewState(stateIn);
  const ctx = buildContext(snap);
  const env = menuEnv(snap, ctx);
  const t = raw.trim();
  const reply = (text: string | string[], next: PreviewState, shown: string | null): PreviewReply => ({ parts: Array.isArray(text) ? text : [text], state: next, shown });

  if (isMenuWord(t) || !t || isBack(t)) return reply(mainMenu(env), PREVIEW_START, "menu");

  const pdf = pdfRequest(t);
  if (pdf) return reply(PDF_NOTE, { path: state.path, awaiting: null }, null);

  try {
    if (state.awaiting) {
      const fx: FlowEnv = { snap, ctx, store: previewStore, payLink: async () => null };
      const r = await handleAwaiting(state.awaiting, t, fx);
      if (r) return reply(r.text, { path: state.path, awaiting: r.next ?? null }, null);
    }

    if (/^\d$/.test(t)) {
      if (state.path === "" || !isModuleKey(state.path)) {
        if (isModuleKey(t)) return reply(moduleMenu(t, env), { path: t, awaiting: null }, `module:${t}`);
        return reply(`Yeh option nahi hai.\n\n${mainMenu(env)}`, PREVIEW_START, "menu");
      }
      const leaf = renderLeaf(state.path, Number(t), env);
      if (!leaf) return reply(`Yeh option nahi hai.\n\n${moduleMenu(state.path, env)}`, { path: state.path, awaiting: null }, `module:${state.path}`);
      return reply(leaf.pdf ? [leaf.text, PDF_NOTE] : leaf.text, { path: state.path, awaiting: leaf.next ?? null }, `${state.path}.${t}`);
    }

    if (!deps.agentReady()) return reply("Is sawal ka jawab abhi nahi de sakta. Menu ke liye *Hi* likho.", { path: state.path, awaiting: null }, null);
    const out = await deps.agent(snap, previewStore, t);
    const parts = [out.text];
    if (out.attachments.length) parts.push(PDF_NOTE);
    return reply(parts, { path: state.path, awaiting: null }, null);
  } catch (e) {
    if (e instanceof PreviewBlocked) return reply(NOT_SAVED, { path: state.path, awaiting: null }, null);
    throw e;
  }
}
