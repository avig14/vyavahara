import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { buildReport } from "../reports/build";
import { khataOverview } from "../analytics/khata-risk";
import { rupees } from "../format";
import { customerReportText, recommendationReportText, reportTextFor, salesReportText, vendorReportText, withoutFoot } from "./reports";
import { MODULES, renderLeaf, menuEnv } from "../menu/menus";

const snap = generateSnapshot();

describe("sales report", () => {
  it("quotes the same totals as the dashboard report", () => {
    for (const period of ["today", "this_week", "this_month"] as const) {
      const r = buildReport(snap, { period });
      const t = salesReportText(snap, period);
      expect(t).toContain(rupees(r.sales.totalPaise));
      expect(t).toContain(`${r.sales.bills} bills`);
      expect(t).toContain(rupees(r.profit.netPaise));
    }
  });
  it("names the period and lists top items", () => {
    const t = salesReportText(snap, "this_week");
    expect(t).toContain(buildReport(snap, { period: "this_week" }).period.label);
    expect(t).toContain("Sabse zyada bika");
  });
});

describe("customer report", () => {
  it("counts segments and quotes the udhaar total", () => {
    const t = customerReportText(snap);
    expect(t).toContain("Customer report");
    expect(t).toMatch(/\d+ regular/);
    expect(t).toContain(rupees(khataOverview(snap).totalOutstandingPaise));
  });
});

describe("vendor report", () => {
  it("lists what is owed", () => {
    const t = vendorReportText(snap);
    expect(t).toContain("Supplier report");
    expect(t).toContain("dena baaki");
  });
});

describe("recommendation report", () => {
  it("groups suggestions and states the guess honestly", () => {
    const t = recommendationReportText(snap);
    expect(t).toContain("Suggestions report");
    expect(t).toMatch(/pakka|andaza|kam bharosa/);
    expect(t).toContain("faisla aapka");
  });
  it("says so when there is nothing to suggest", () => {
    const empty = { ...snap, products: [], transactions: [], saleItems: [], khata: [], purchases: [], purchaseItems: [], vendorPayments: [], lostDemand: [] } as typeof snap;
    expect(recommendationReportText(empty)).toBeTypeOf("string");
  });
});

describe("report wiring in the menu tree", () => {
  const env = menuEnv(snap);
  it("each new report is a leaf the module menu lists", () => {
    const want: [Parameters<typeof renderLeaf>[0], number, string][] = [["2", 6, "Supplier report"], ["3", 7, "Customer report"], ["4", 8, "Sales report"], ["5", 7, "Suggestions report"]];
    for (const [k, n, head] of want) {
      expect(MODULES[k].items).toHaveLength(n);
      const leaf = renderLeaf(k, n, env);
      expect(leaf?.text).toContain(head);
      expect(leaf?.text).toContain("peeche");
      expect(leaf?.text).not.toContain("Menu ke liye *Hi* likhiye");
    }
  });
  it("no module offers more than 8 options, because 9 is Back", () => {
    for (const m of Object.values(MODULES)) expect(m.items.length).toBeLessThanOrEqual(8);
  });
  it("withoutFoot drops only the closing line", () => {
    const t = salesReportText(snap, "today");
    expect(t).toContain("Menu ke liye *Hi* likhiye");
    expect(withoutFoot(t)).not.toContain("Menu ke liye *Hi* likhiye");
    expect(withoutFoot(t)).toContain("Sales report");
  });
  it("reportTextFor dispatches by kind", () => {
    expect(reportTextFor(snap, "customers")).toContain("Customer report");
    expect(reportTextFor(snap, "recommendations")).toContain("Suggestions report");
  });
});

import { formatWa, tokenizeWa } from "./format-wa";
describe("whatsapp formatting", () => {
  it("turns *bold*, _italic_ and links into tokens, never HTML", () => {
    expect(tokenizeWa("Sale *₹250* ho gayi _aaj_ https://x.test/a")).toEqual([
      { kind: "text", text: "Sale " },
      { kind: "bold", text: "₹250" },
      { kind: "text", text: " ho gayi " },
      { kind: "italic", text: "aaj" },
      { kind: "text", text: " " },
      { kind: "link", text: "https://x.test/a" },
    ]);
    expect(tokenizeWa("<b>x</b>")).toEqual([{ kind: "text", text: "<b>x</b>" }]);
  });
  it("keeps blank lines and reads our real reports without leftovers", () => {
    const t = formatWa("a\n\n*b*");
    expect(t).toHaveLength(3);
    expect(t[1]).toEqual([]);
    const all = formatWa(salesReportText(snap, "today")).flat();
    expect(all.some((x) => x.kind === "bold")).toBe(true);
    expect(all.filter((x) => x.kind === "text").every((x) => !/\*[^*\s][^*]*\*/.test(x.text))).toBe(true);
  });
});

import { MENU_LIST, interactiveFor, moduleList, textForTap, type Interactive } from "./interactive";
describe("tappable messages", () => {
  const all = ["menu", "module:1", "module:2", "module:3", "module:4", "module:5", "4.1", "3.7", null];
  const check = (i: Interactive) => {
    if (i.kind === "buttons") {
      expect(i.buttons.length).toBeGreaterThan(0);
      expect(i.buttons.length).toBeLessThanOrEqual(3);
      for (const b of i.buttons) expect(b.title.length).toBeLessThanOrEqual(20);
    } else {
      expect(i.button.length).toBeLessThanOrEqual(20);
      const rows = i.sections.flatMap((s) => s.rows);
      expect(rows.length).toBeLessThanOrEqual(10);
      for (const r of rows) {
        expect(r.title.length).toBeLessThanOrEqual(24);
        expect((r.description ?? "").length).toBeLessThanOrEqual(72);
      }
    }
  };
  it("respects Meta limits for buttons and lists", () => {
    for (const k of all) check(interactiveFor(k));
  });
  it("the main menu lists the five modules and a tap is the digit", () => {
    expect(interactiveFor("menu")).toBe(MENU_LIST);
    const rows = MENU_LIST.kind === "list" ? MENU_LIST.sections.flatMap((s) => s.rows) : [];
    expect(rows.map((r) => r.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(textForTap("3")).toBe("3");
    expect(textForTap("menu")).toBe("Hi");
  });
  it("a module list offers every item and a way back", () => {
    for (const k of ["1", "2", "3", "4", "5"] as const) {
      const l = moduleList(k);
      const ids = l.kind === "list" ? l.sections.flatMap((s) => s.rows.map((r) => r.id)) : [];
      expect(ids).toEqual([...MODULES[k].items.map((_, i) => String(i + 1)), "9"]);
    }
  });
});
