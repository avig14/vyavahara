import { describe, expect, it } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { buildReport } from "../reports/build";
import { khataOverview } from "../analytics/khata-risk";
import { rupees } from "../format";
import { customerReportText, recommendationReportText, reportTextFor, salesReportText, vendorReportText } from "./reports";
import { intentOf, salesPeriod, MENU } from "./router";

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

describe("whatsapp wiring", () => {
  it("routes the new asks", () => {
    expect(intentOf("6", null)).toBe("sales");
    expect(intentOf("sales report", null)).toBe("sales");
    expect(intentOf("6 week", null)).toBe("sales");
    expect(intentOf("7", null)).toBe("customers");
    expect(intentOf("customer report", null)).toBe("customers");
    expect(intentOf("8", null)).toBe("vendors");
    expect(intentOf("vendor report", null)).toBe("vendors");
    expect(intentOf("9", null)).toBe("recs");
    expect(intentOf("suggestions", null)).toBe("recs");
    expect(intentOf("1", null)).toBe("report");
    expect(intentOf("aaj kitni sale hui", null)).toBe("agent");
  });
  it("picks the sales period from words", () => {
    expect(salesPeriod("6 week")).toBe("this_week");
    expect(salesPeriod("sales month")).toBe("this_month");
    expect(salesPeriod("6")).toBe("today");
  });
  it("menu lists the new reports", () => {
    for (const w of ["Sales report", "Customer report", "Supplier report", "Suggestions"]) expect(MENU).toContain(w);
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
