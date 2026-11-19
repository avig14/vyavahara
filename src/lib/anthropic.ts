import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

let _client: Anthropic | null = null;
/** Lazy so `next build` works without ANTHROPIC_API_KEY. */
export function getAnthropic(): Anthropic {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic();
  return _client;
}
