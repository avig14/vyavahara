/**
 * Tappable messages (reply buttons and a list menu) for the dashboard chat preview, in the shape the WhatsApp Cloud API uses.
 * Meta's limits are enforced in the tests: at most 3 reply buttons (title 20 chars); a list has at most 10 rows
 * in total (row title 24, description 72) and its opener button is at most 20 chars.
 * Every id is the text the owner would have typed, so a tap goes through the same menu tree as typing.
 */
import { isModuleKey, MODULES, type ModuleKey } from "../menu/menus";

export interface ReplyButton {
  /** what a tap sends to the bot */
  id: string;
  title: string;
}
export interface ListRow extends ReplyButton {
  description?: string;
}
export type Interactive =
  | { kind: "buttons"; buttons: ReplyButton[] }
  | { kind: "list"; button: string; title: string; sections: { title: string; rows: ListRow[] }[] };

const KEYS = Object.keys(MODULES) as ModuleKey[];

const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/** The five modules, as the main menu. */
export const MENU_LIST: Interactive = {
  kind: "list",
  button: "Menu dekhein",
  title: "Kya dekhna hai?",
  sections: [{ title: "Dukaan", rows: KEYS.map((k) => ({ id: k, title: cut(`${MODULES[k].emoji} ${MODULES[k].title}`, 24), description: cut(MODULES[k].items.slice(0, 3).join(" · "), 72) })) }],
};

const btn = (id: string, title: string): ReplyButton => ({ id, title });
const MENU_BTN = btn("menu", "Menu");

/** The options of one module, plus a way back. A module has at most 8 items, so it stays under the 10-row cap. */
export function moduleList(key: ModuleKey): Interactive {
  const m = MODULES[key];
  return {
    kind: "list",
    button: "Options dekhein",
    title: cut(`${m.emoji} ${m.title}`, 60),
    sections: [
      {
        title: cut(m.title, 24),
        rows: [...m.items.map((label, i) => ({ id: String(i + 1), title: cut(label, 24), description: cut(label, 72) })), { id: "9", title: "↩️ Peeche", description: "Main menu par wapas" }],
      },
    ],
  };
}

/** Buttons offered under a reply. `shown` is what the preview just showed (see PreviewReply.shown). */
export function interactiveFor(shown: string | null): Interactive {
  if (shown === "menu") return MENU_LIST;
  if (shown?.startsWith("module:")) {
    const k = shown.slice(7);
    if (isModuleKey(k)) return moduleList(k);
  }
  if (shown && /^[1-5]\.\d$/.test(shown)) return { kind: "buttons", buttons: [btn("9", "↩️ Peeche"), MENU_BTN] };
  return { kind: "buttons", buttons: [MENU_BTN] };
}

/** "menu" is the one id that is not a digit: it means the same as typing Hi. */
export const textForTap = (id: string): string => (id === "menu" ? "Hi" : id);
