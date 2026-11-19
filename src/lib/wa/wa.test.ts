import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { generateSnapshot } from "../seed/generate";
import { classify, maskPhone, normalizePhone, parseWebhook, sendLongText, sendText, splitMessage, verifySignature, waConfig, WaError } from "./cloud";
import { stockText, whatsappDigest } from "./digest";

const cfg = { token: "TOKEN-SECRET", phoneNumberId: "123", version: "v27.0" };
const okFetch = (id = "wamid.A") => vi.fn(async () => new Response(JSON.stringify({ messages: [{ id }] }), { status: 200 })) as unknown as typeof fetch;
const errFetch = (code: number, status = 400) =>
  vi.fn(async () => new Response(JSON.stringify({ error: { code, message: "Recipient 919999999999" } }), { status })) as unknown as typeof fetch;

describe("phone numbers", () => {
  it("normalises Indian numbers to digits with 91", () => {
    expect(normalizePhone("98765 43210")).toBe("919876543210");
    expect(normalizePhone("+91 98765-43210")).toBe("919876543210");
    expect(normalizePhone("09876543210")).toBe("919876543210");
    expect(normalizePhone("whatsapp:+919876543210")).toBe("919876543210");
    expect(normalizePhone("+1 650 555 1234")).toBe("16505551234");
  });
  it("rejects things that cannot be a number", () => {
    for (const x of ["", "abc", "12345", "5876543210", null, undefined, "1".repeat(16)]) expect(normalizePhone(x as string)).toBeNull();
  });
  it("masks all but the ends", () => expect(maskPhone("919876543210")).toBe("91••••••3210"));
});

describe("config and send", () => {
  it("needs both token and phone number id", () => {
    expect(waConfig({})).toBeNull();
    expect(waConfig({ WHATSAPP_ACCESS_TOKEN: "t" })).toBeNull();
    expect(waConfig({ WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" })).toMatchObject({ version: "v27.0" });
    expect(waConfig({ WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_API_VERSION: "v30.0" })?.version).toBe("v30.0");
  });

  it("posts the documented request and returns the wamid", async () => {
    const f = okFetch("wamid.X");
    expect(await sendText("919876543210", "hi", cfg, f)).toEqual({ wamid: "wamid.X" });
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v27.0/123/messages");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer TOKEN-SECRET");
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "919876543210",
      type: "text",
      text: { preview_url: false, body: "hi" },
    });
  });

  it("maps Meta errors to an action the owner can take, without leaking number or token", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [code, kind] of [
      [131047, "window"],
      [131030, "not_allowed"],
      [190, "token"],
      [130429, "rate"],
      [131026, "bad_number"],
      [999, "other"],
    ] as const) {
      const e = await sendText("919876543210", "hi", cfg, errFetch(code)).catch((x) => x);
      expect(e).toBeInstanceOf(WaError);
      expect(e.kind).toBe(kind);
      expect(e.message).not.toMatch(/9198|TOKEN/);
    }
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/TOKEN-SECRET|919999999999/);
    spy.mockRestore();
  });

  it("network failure is a clear error", async () => {
    const f = vi.fn(async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    await expect(sendText("919876543210", "x", cfg, f)).rejects.toMatchObject({ kind: "other", httpStatus: 0 });
  });

  it("a 200 without a message id is treated as a failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const f = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    await expect(sendText("919876543210", "x", cfg, f)).rejects.toBeInstanceOf(WaError);
    spy.mockRestore();
  });

  it("classify covers the window rule", () => expect(classify(131047, 400).kind).toBe("window"));
});

describe("long messages", () => {
  it("splits on line breaks under the limit and loses nothing", () => {
    const text = Array.from({ length: 300 }, (_, i) => `line ${i} ${"x".repeat(30)}`).join("\n");
    const parts = splitMessage(text, 1000);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 1000)).toBe(true);
    expect(parts.join("\n")).toBe(text);
  });
  it("cuts a single huge line hard", () => expect(splitMessage("a".repeat(2500), 1000).map((p) => p.length)).toEqual([1000, 1000, 500]));
  it("sends every part in order and returns the last id", async () => {
    let n = 0;
    const f = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: `w${++n}` }] }), { status: 200 })) as unknown as typeof fetch;
    const r = await sendLongText("919876543210", ["a".repeat(3000), "b".repeat(3000)].join("\n"), cfg, f);
    expect(r).toEqual({ wamid: "w2", parts: 2 });
  });
});

describe("webhook", () => {
  const body = (value: object) => ({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value }] }] });

  it("reads an inbound text", () => {
    const r = parseWebhook(body({ messages: [{ from: "919876543210", id: "wamid.IN", type: "text", text: { body: "Hi" } }] }));
    expect(r.messages).toEqual([{ id: "wamid.IN", from: "919876543210", type: "text", text: "Hi", reply: null }]);
  });

  it("reads a tapped list reply", () => {
    const r = parseWebhook(body({ messages: [{ from: "91", id: "w", type: "interactive", interactive: { list_reply: { id: "m_stock", title: "Stock" } } }] }));
    expect(r.messages[0]).toMatchObject({ type: "interactive", text: null, reply: "m_stock" });
  });

  it("reads delivery statuses including a failure", () => {
    const r = parseWebhook(
      body({ statuses: [{ id: "w1", status: "delivered" }, { id: "w2", status: "failed", errors: [{ code: 131047, title: "Re-engagement message" }] }, { id: "w3", status: "weird" }] }),
    );
    expect(r.statuses).toEqual([
      { id: "w1", status: "delivered", code: null, detail: null },
      { id: "w2", status: "failed", code: 131047, detail: "Re-engagement message" },
    ]);
  });

  it("garbage never throws", () => {
    for (const x of [null, 5, "x", {}, { entry: "no" }, { entry: [null, { changes: 3 }, { changes: [{ value: null }] }] }]) {
      expect(parseWebhook(x)).toEqual({ messages: [], statuses: [] });
    }
  });

  it("checks the signature and rejects tampering", () => {
    const raw = '{"a":1}';
    const sig = "sha256=" + createHmac("sha256", "secret").update(raw).digest("hex");
    expect(verifySignature(raw, sig, "secret")).toBe(true);
    expect(verifySignature(raw + " ", sig, "secret")).toBe(false);
    expect(verifySignature(raw, sig, "other")).toBe(false);
    expect(verifySignature(raw, null, "secret")).toBe(false);
    expect(verifySignature(raw, "sha256=zz", "secret")).toBe(false);
  });
});

describe("digest: real numbers, phone sized", () => {
  const snap = generateSnapshot({ now: new Date("2026-11-19T09:30:00Z") });
  const d = whatsappDigest(snap);
  it("opens with the shop and carries sales and stock from the data", () => {
    expect(d.text).toContain(snap.merchant.name);
    expect(d.sections).toEqual(expect.arrayContaining(["today", "sales"]));
    expect(d.text).toMatch(/₹/);
  });
  it("fits one WhatsApp message", () => expect(d.text.length).toBeLessThan(3800));
  it("has no expiry section because expiry is not tracked", () => expect(d.text.toLowerCase()).not.toMatch(/expir/));
  it("has no undefined or NaN", () => expect(d.text).not.toMatch(/undefined|NaN|\[object/));
  it("stockText is just the stock block", () => {
    const t = stockText(snap);
    expect(t).not.toMatch(/Sales/);
    expect(t.length).toBeGreaterThan(10);
  });
});
