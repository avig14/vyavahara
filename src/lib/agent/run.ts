/** Free-form Hinglish agent (PRD B7): Claude + tools over the merchant's snapshot. Used by WhatsApp and web chat. */
import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "../db/client";
import type { Snapshot } from "../domain";
import { loadSnapshot, recentConversation, saveConversationTurn } from "../db/queries";
import { getAnthropic, MODEL } from "../anthropic";
import { SYSTEM_PROMPT, VOICE_PROMPT } from "./prompt";
import type { Channel } from "../db/queries";
import { dbStore, readOnlyStore, type AgentStore } from "./store";
import { buildTools, type Attachment } from "./tools";

export type Turn = { role: "user" | "assistant"; content: string };
export interface AgentResult {
  text: string;
  attachments: Attachment[];
}

const REFUSAL = "Maaf kijiye, yeh main nahi kar sakta.";
const FALLBACK = "Abhi jawab nahi bana paya. Dobara try karein ya 'Hi' likhein.";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

function effort(): Effort {
  const e = process.env.CLAUDE_EFFORT as Effort | undefined;
  return e && EFFORTS.includes(e) ? e : "low";
}

/** History must open with a user turn. */
export function cleanHistory(h: Turn[]): Turn[] {
  const i = h.findIndex((t) => t.role === "user");
  return i < 0 ? [] : h.slice(i);
}

/** Core: no DB. Tests pass a fake client + fake store. */
export async function runAgentWith(a: {
  snap: Snapshot;
  store: AgentStore;
  history: Turn[];
  text: string;
  client?: Pick<Anthropic, "beta">;
  maxIterations?: number;
  /** defaults to the WhatsApp/chat prompt; the Soundbox passes VOICE_PROMPT */
  system?: string;
  onTool?: (name: string) => void;
}): Promise<AgentResult> {
  const client = a.client ?? getAnthropic();
  const attachments: Attachment[] = [];
  const tools = buildTools({ snap: a.snap, store: a.store, attachments, onTool: a.onTool });
  const final = await client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: effort() },
    system: [{ type: "text", text: a.system ?? SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools,
    messages: [...cleanHistory(a.history), { role: "user", content: a.text }],
    max_iterations: a.maxIterations ?? 6,
  });
  if (final.stop_reason === "refusal") return { text: REFUSAL, attachments: [] };
  const text = final.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { text: text || FALLBACK, attachments };
}

export async function runAgent(db: Db, merchantId: string, text: string, channel: Channel, opts: { now?: Date; onTool?: (name: string) => void; readonly?: boolean } = {}): Promise<AgentResult> {
  const [snap, rows] = await Promise.all([loadSnapshot(db, merchantId, { now: opts.now }), recentConversation(db, merchantId, channel, channel === "voice" ? 4 : 8)]);
  const history: Turn[] = rows.map((r) => ({ role: r.role as Turn["role"], content: r.content }));
  const system = channel === "voice" ? VOICE_PROMPT : SYSTEM_PROMPT;
  const store = opts.readonly ? readOnlyStore(dbStore(db, merchantId, "ai")) : dbStore(db, merchantId, "ai");
  const out = await runAgentWith({ snap, store, history, text, system, onTool: opts.onTool });
  await saveConversationTurn(db, merchantId, channel, [
    { role: "user", content: text },
    { role: "assistant", content: out.text },
  ]);
  return out;
}
