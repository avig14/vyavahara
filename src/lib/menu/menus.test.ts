import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { dateRange, isBack, isMenuWord, MODULES, mainMenu, menuEnv, moduleMenu, pdfRequest, pickIndex, renderLeaf, type ModuleKey } from "./menus";

const NOW = new Date("2026-11-19T09:30:00Z");
const env = menuEnv(generateSnapshot({ now: NOW }));
const keys = Object.keys(MODULES) as ModuleKey[];

describe("menu words", () => {
  it("greetings open the menu, sentences do not", () => {
    for (const w of ["Hi", "hello", "  MENU ", "0", "Namaste!", "नमस्ते", "hi ji"]) expect(isMenuWord(w), w).toBe(true);
    for (const w of ["hi what is my stock", "1", "aaj ki sales?", ""]) expect(isMenuWord(w), w).toBe(false);
  });
  it("back + pick", () => {
    expect(isBack(" 9 ")).toBe(true);
    expect(pickIndex("2", 3)).toBe(1);
    expect(pickIndex("4", 3)).toBeNull();
    expect(pickIndex("two", 3)).toBeNull();
  });
  it("pdf requests", () => {
    expect(pdfRequest("PDF bhejo")).toEqual({ period: "today" });
    expect(pdfRequest("week ka pdf")).toEqual({ period: "this_week" });
    expect(pdfRequest("send me a detailed pdf of everything about last quarter please")).toBeNull();
    expect(pdfRequest("hello")).toBeNull();
  });
});

describe("custom dates", () => {
  it("parses d/m ranges and ISO", () => {
    expect(dateRange("1/11 to 15/11", NOW)).toEqual({ from: "2026-11-01", to: "2026-11-15" });
    expect(dateRange("2026-10-01 se 2026-10-31", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("swaps reversed, rejects junk and one date", () => {
    expect(dateRange("15/11 1/11", NOW)).toEqual({ from: "2026-11-01", to: "2026-11-15" });
    expect(dateRange("31/02 to 1/03", NOW)).toBeNull();
    expect(dateRange("kal", NOW)).toBeNull();
    expect(dateRange("1/11", NOW)).toBeNull();
  });
});

describe("main menu + modules", () => {
  it("main menu greets, shows today and all 5 modules", () => {
    const m = mainMenu(env);
    expect(m).toMatch(/Namaste/);
    expect(m).toMatch(/Aaj ab tak/);
    for (const k of keys) expect(m).toContain(MODULES[k].title);
  });
  it("every module lists its options with a live summary and a back hint", () => {
    for (const k of keys) {
      const t = moduleMenu(k, env);
      expect(t).toContain(MODULES[k].title.toUpperCase());
      expect(t).toMatch(/\*9\*|9️/);
      expect(t.split("\n").length).toBeGreaterThan(MODULES[k].items.length);
    }
  });
});

describe("every leaf renders from the seed without AI or DB", () => {
  for (const k of keys)
    MODULES[k].items.forEach((label, i) => {
      it(`${k}.${i + 1} ${label}`, () => {
        const leaf = renderLeaf(k, i + 1, env);
        expect(leaf).not.toBeNull();
        expect(leaf!.text.length).toBeGreaterThan(20);
        expect(leaf!.text).not.toMatch(/undefined|NaN|\[object/);
        expect(leaf!.text.length).toBeLessThan(3000);
      });
    });
  it("out-of-range digit is not a leaf", () => {
    expect(renderLeaf("1", 9, env)).toBeNull();
    expect(renderLeaf("5", 8, env)).toBeNull();
  });
  it("leaves that need input wait for it", () => {
    expect(renderLeaf("4", 4, env)!.next?.kind).toBe("custom_dates");
    expect(renderLeaf("3", 2, env)!.next?.kind).toBe("udhaar_entry");
    expect(renderLeaf("1", 6, env)!.next?.kind).toBe("stock_add");
    expect(renderLeaf("3", 4, env)!.next?.kind).toBe("pick_reminder");
    expect(renderLeaf("2", 4, env)!.next?.kind).toBe("pick_pay");
    expect(renderLeaf("5", 5, env)!.next?.kind).toBe("screenshot");
    expect(renderLeaf("4", 5, env)!.pdf).toEqual({ period: "today" });
  });
  it("the planted demo story shows up: Suresh is risky, Maggi needs ordering", () => {
    expect(renderLeaf("3", 3, env)!.text).toMatch(/Suresh/);
    expect(renderLeaf("1", 3, env)!.text).toMatch(/Maggi/);
  });
});
