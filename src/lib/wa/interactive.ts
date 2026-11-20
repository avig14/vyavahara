/**
 * Tappable WhatsApp messages (reply buttons and a list menu), like the Delhi Metro bot.
 * One definition for the on-screen preview and, later, the real Cloud API, which has the same two shapes.
 * Meta's limits are enforced in the tests: at most 3 reply buttons (title 20 chars); a list has at most 10 rows
 * in total (row title 24, description 72) and its opener button is at most 20 chars.
 * Every id is the text the owner would have typed, so a tap goes through the same router as typing.
 */
import { intentOf, salesPeriod, type Intent } from "./router";

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

export const MENU_LIST: Interactive = {
  kind: "list",
  button: "Menu dekhein",
  title: "Kya dekhna hai?",
  sections: [
    {
      title: "Reports",
      rows: [
        { id: "1", title: "Aaj ka poora report", description: "Sale, munafa, stock, udhaar ek saath" },
        { id: "6", title: "Sales report", description: "Kitna bika, kya sabse zyada bika" },
        { id: "7", title: "Customer report", description: "Regular, naye aur laut ke nahi aaye" },
        { id: "8", title: "Supplier report", description: "Kisko kitna dena hai, rate badle" },
        { id: "9", title: "Suggestions", description: "Aaj kya karna chahiye" },
      ],
    },
    {
      title: "Dukaan",
      rows: [
        { id: "2", title: "Stock", description: "Kya mangwana hai" },
        { id: "3", title: "Udhaar (khata)", description: "Kiska kitna baaki hai" },
        { id: "4", title: "Supplier payments", description: "Kaun si payment due hai" },
        { id: "5", title: "PDF report", description: "Aaj ka report PDF mein" },
      ],
    },
  ],
};

const btn = (id: string, title: string): ReplyButton => ({ id, title });
const MENU_BTN = btn("menu", "Menu");

/** Buttons offered under a reply, so the owner can keep tapping instead of typing. */
export function interactiveFor(text: string | null): Interactive {
  const intent: Intent = intentOf(text, null);
  if (intent === "menu") return MENU_LIST;
  if (intent === "sales") {
    const p = salesPeriod(text);
    return { kind: "buttons", buttons: [btn(p === "this_week" ? "6" : "6 week", p === "this_week" ? "Aaj ki sales" : "Is hafte ki"), btn(p === "this_month" ? "6 week" : "6 month", p === "this_month" ? "Is hafte ki" : "Is mahine ki"), MENU_BTN] };
  }
  const next: Partial<Record<Intent, [ReplyButton, ReplyButton]>> = {
    report: [btn("6 week", "Sales report"), btn("9", "Suggestions")],
    customers: [btn("8", "Supplier report"), btn("9", "Suggestions")],
    vendors: [btn("7", "Customer report"), btn("9", "Suggestions")],
    recs: [btn("2", "Stock"), btn("3", "Udhaar")],
    stock: [btn("9", "Suggestions"), btn("1", "Poora report")],
    khata: [btn("7", "Customer report"), btn("9", "Suggestions")],
    suppliers: [btn("8", "Supplier report"), btn("9", "Suggestions")],
    pdf: [btn("1", "Poora report"), btn("6 week", "Sales report")],
  };
  const pair = next[intent];
  return { kind: "buttons", buttons: pair ? [...pair, MENU_BTN] : [MENU_BTN] };
}

/** "menu" is the one id that is not a digit: it means the same as typing Hi. */
export const textForTap = (id: string): string => (id === "menu" ? "Hi" : id);
