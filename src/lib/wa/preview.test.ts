import { describe, expect, it, vi } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { buildContext } from "../analytics/recommendations";
import { cleanPreviewState, PREVIEW_START, previewReply, previewStore, type PreviewDeps, type PreviewState } from "./preview";

const snap = generateSnapshot({ now: new Date("2026-11-19T09:30:00Z") });
const deps = (o: Partial<PreviewDeps> = {}): PreviewDeps => ({ agentReady: () => true, agent: async (_s, _st, text) => ({ text: `AGENT:${text}`, attachments: [] }), ...o });

/** type a few messages in a row, carrying the state like the browser does */
async function chat(lines: string[], d = deps()) {
  let state: PreviewState = PREVIEW_START;
  const out = [];
  for (const l of lines) {
    const r = await previewReply(snap, l, state, d);
    state = r.state;
    out.push(r);
  }
  return out;
}

describe("preview chat", () => {
  it("Hi opens the main menu; a digit opens a module; 9 goes back", async () => {
    const [hi, m3, back] = await chat(["Hi", "3", "9"]);
    expect(hi.shown).toBe("menu");
    expect(hi.parts[0]).toContain("Customers & Khata");
    expect(m3.shown).toBe("module:3");
    expect(m3.state.path).toBe("3");
    expect(back.state).toEqual(PREVIEW_START);
  });

  it("runs the new reports from the menu with the shop's numbers", async () => {
    const r = await chat(["Hi", "4", "8"]);
    expect(r[2].shown).toBe("4.8");
    expect(r[2].parts[0]).toContain("Sales report");
    const c = await chat(["Hi", "3", "7"]);
    expect(c[2].parts[0]).toContain("Customer report");
    const v = await chat(["Hi", "2", "6"]);
    expect(v[2].parts[0]).toContain("Supplier report");
    const s = await chat(["Hi", "5", "7"]);
    expect(s[2].parts[0]).toContain("Suggestions report");
    void buildContext;
  });

  it("an unknown digit stays put and re-shows the menu", async () => {
    const r = await chat(["Hi", "7"]);
    expect(r[1].parts[0]).toContain("Yeh option nahi hai");
    expect(r[1].state).toEqual(PREVIEW_START);
  });

  it("a step that waits for an answer carries over in the state", async () => {
    const r = await chat(["Hi", "4", "4", "1/11 to 15/11"]);
    expect(r[2].state.awaiting).toEqual({ kind: "custom_dates" });
    expect(r[3].parts[0]).toContain("Sales"); // the custom-range report
    expect(r[3].state.awaiting).toBeNull();
  });

  it("never saves: an udhaar entry is blocked and says so", async () => {
    const name = snap.customers[0].name.split(" ")[0];
    const r = await chat(["Hi", "3", "2", `${name} 300`]);
    expect(r[3].parts[0]).toContain("Preview mode");
    expect(r[3].state.awaiting).toBeNull();
  });

  it("every write on the preview store refuses", async () => {
    for (const fn of [previewStore.addKhataEntry, previewStore.adjustStock, previewStore.createPending, previewStore.payVendorBill, previewStore.createPurchaseOrder]) {
      await expect((fn as (a: never, b?: never) => Promise<unknown>)({} as never)).rejects.toThrow(/preview/);
    }
  });

  it("free text goes to the agent with the blocked store; no key means an honest fallback", async () => {
    const agent = vi.fn(async () => ({ text: "Aaj ki sale ₹1,000", attachments: [] }));
    const r = await chat(["aaj ki sale kitni hui"], deps({ agent }));
    expect(agent).toHaveBeenCalledWith(snap, previewStore, "aaj ki sale kitni hui");
    expect(r[0].parts[0]).toBe("Aaj ki sale ₹1,000");
    const none = vi.fn();
    const n = await chat(["aaj ki sale kitni hui"], deps({ agent: none as never, agentReady: () => false }));
    expect(none).not.toHaveBeenCalled();
    expect(n[0].parts[0]).toContain("abhi nahi de sakta");
  });

  it("an agent PDF attachment becomes a preview note, and a PDF ask never mints a link", async () => {
    const r = await chat(["Hi", "pdf bhejo"]);
    expect(r[1].parts[0]).toContain("Preview mein PDF nahi jaata");
    const a = await chat(["report bhejo"], deps({ agent: async () => ({ text: "Yeh lo", attachments: [{ period: "today" }] }) as never }));
    expect(a[0].parts).toHaveLength(2);
  });

  it("1 and 2 are menu digits here, they never answer a confirmation", async () => {
    const r = await chat(["1", "2"]);
    expect(r[0].shown).toBe("module:1");
    expect(r[1].shown).toBe("1.2");
  });
});

describe("cleanPreviewState", () => {
  it("accepts a good state and drops anything odd", () => {
    expect(cleanPreviewState({ path: "2", awaiting: { kind: "pick_po", vendorIds: ["v1"] } })).toEqual({ path: "2", awaiting: { kind: "pick_po", vendorIds: ["v1"] } });
    expect(cleanPreviewState(null)).toEqual(PREVIEW_START);
    expect(cleanPreviewState("x")).toEqual(PREVIEW_START);
    expect(cleanPreviewState({ path: "99", awaiting: { kind: "pick_po", vendorIds: [1, 2] } })).toEqual(PREVIEW_START);
    expect(cleanPreviewState({ path: "1", awaiting: { kind: "alert", customerId: "c", name: "n" } })).toEqual({ path: "1", awaiting: null });
    expect(cleanPreviewState({ path: "1", awaiting: { kind: "nope" } })).toEqual({ path: "1", awaiting: null });
  });
});
