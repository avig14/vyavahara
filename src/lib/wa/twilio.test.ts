import { describe, expect, it, vi } from "vitest";
import twilio from "twilio";
import {
  classifyTwilio,
  expectedSignature,
  fetchTwilioMedia,
  parseInbound,
  parseStatus,
  publicWebhookUrl,
  readForm,
  sendTwilioMedia,
  sendTwilioText,
  toWhatsApp,
  twilioConfig,
  verifyTwilioSignature,
} from "./twilio";

const TOKEN = "test-token-not-real";
const URL_ = "https://vyavahara.example.test/api/twilio/webhook";
const cfg = { accountSid: "ACtest", authToken: TOKEN, from: "+15550001111", mode: "live" as const, dailyCap: 40, joinCode: "join x-y" };

describe("twilioConfig", () => {
  it("needs all three vars", () => {
    expect(twilioConfig({})).toBeNull();
    expect(twilioConfig({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t" })).toBeNull();
  });
  it("reads the sender with or without whatsapp: prefix and sets defaults", () => {
    const c = twilioConfig({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_WHATSAPP_FROM: "whatsapp:+1 (737) 250-8034" })!;
    expect(c.from).toBe("+17372508034");
    expect(c.mode).toBe("live");
    expect(c.dailyCap).toBe(40);
    expect(c.joinCode).toBe("join twilio-trial");
  });
  it("dry mode, custom cap and join code", () => {
    const c = twilioConfig({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_WHATSAPP_FROM: "+17372508034", TWILIO_SEND_MODE: "DRY", TWILIO_DAILY_CAP: "10", TWILIO_SANDBOX_JOIN_CODE: "join abc-def" })!;
    expect(c).toMatchObject({ mode: "dry", dailyCap: 10, joinCode: "join abc-def" });
  });
});

describe("signature", () => {
  const params = { Body: "Hi", From: "whatsapp:+919876543210", To: "whatsapp:+15550001111", MessageSid: "SM123", NumMedia: "0", ProfileName: "Ravi ₹" };

  it("matches the official SDK for plain, unicode and repeated params", () => {
    for (const p of [params, { ...params, Body: "नमस्ते दुकान" }, { ...params, Tag: ["b", "a", "b"] }, {}]) {
      const sdk = twilio.getExpectedTwilioSignature(TOKEN, URL_, p as Record<string, unknown>);
      expect(expectedSignature(TOKEN, URL_, p)).toBe(sdk);
      expect(twilio.validateRequest(TOKEN, sdk, URL_, p as Record<string, unknown>)).toBe(true);
      expect(verifyTwilioSignature(TOKEN, sdk, URL_, p)).toBe(true);
    }
  });
  it("rejects a wrong token, wrong url, tampered body, missing or short header", () => {
    const sig = expectedSignature(TOKEN, URL_, params);
    expect(verifyTwilioSignature("other", sig, URL_, params)).toBe(false);
    expect(verifyTwilioSignature(TOKEN, sig, URL_ + "?x=1", params)).toBe(false);
    expect(verifyTwilioSignature(TOKEN, sig, URL_, { ...params, Body: "Hello" })).toBe(false);
    expect(verifyTwilioSignature(TOKEN, null, URL_, params)).toBe(false);
    expect(verifyTwilioSignature(TOKEN, "abc", URL_, params)).toBe(false);
  });
});

describe("webhook parsing", () => {
  it("publicWebhookUrl prefers the configured base", () => {
    const req = new Request("http://localhost:3000/api/twilio/webhook?a=1", { method: "POST" });
    expect(publicWebhookUrl(req, {})).toBe("http://localhost:3000/api/twilio/webhook?a=1");
    expect(publicWebhookUrl(req, { APP_BASE_URL: "https://x.test/" })).toBe("https://x.test/api/twilio/webhook?a=1");
    expect(publicWebhookUrl(req, { APP_BASE_URL: "https://x.test", TWILIO_WEBHOOK_BASE: "https://tunnel.test" })).toBe("https://tunnel.test/api/twilio/webhook?a=1");
  });
  it("readForm reads form-encoded bodies, repeated keys become arrays", async () => {
    const req = new Request(URL_, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "Body=Hi+there&From=whatsapp%3A%2B919876543210&Tag=a&Tag=b" });
    expect(await readForm(req)).toEqual({ Body: "Hi there", From: "whatsapp:+919876543210", Tag: ["a", "b"] });
  });
  it("parseInbound: text", () => {
    expect(parseInbound({ MessageSid: "SM1", From: "whatsapp:+91 98765 43210", Body: "  Hi  ", NumMedia: "0", ProfileName: "Ravi" })).toEqual({ id: "SM1", from: "919876543210", text: "Hi", media: null, profileName: "Ravi" });
  });
  it("parseInbound: voice note and photo", () => {
    const v = parseInbound({ MessageSid: "SM2", From: "whatsapp:+919876543210", Body: "", NumMedia: "1", MediaUrl0: "https://api.twilio.com/m/1", MediaContentType0: "audio/ogg" });
    expect(v).toMatchObject({ text: null, media: { url: "https://api.twilio.com/m/1", type: "audio/ogg" } });
    const p = parseInbound({ MessageSid: "SM3", From: "whatsapp:+919876543210", Body: "bill", NumMedia: "1", MediaUrl0: "https://api.twilio.com/m/2", MediaContentType0: "IMAGE/JPEG" });
    expect(p).toMatchObject({ text: "bill", media: { type: "image/jpeg" } });
  });
  it("parseInbound ignores SMS and junk", () => {
    expect(parseInbound({ MessageSid: "SM1", From: "+919876543210", Body: "x" })).toBeNull();
    expect(parseInbound({ From: "whatsapp:+919876543210", Body: "x" })).toBeNull();
    expect(parseInbound({ MessageSid: "SM1", From: "whatsapp:+12", Body: "x" })).toBeNull();
  });
  it("parseStatus maps statuses and ignores in-flight ones", () => {
    expect(parseStatus({ MessageSid: "SM1", MessageStatus: "delivered" })).toEqual({ id: "SM1", status: "delivered", code: null, detail: null });
    expect(parseStatus({ MessageSid: "SM1", MessageStatus: "read" })?.status).toBe("read");
    expect(parseStatus({ MessageSid: "SM1", MessageStatus: "undelivered", ErrorCode: "63016", ChannelStatusMessage: "outside window" })).toEqual({ id: "SM1", status: "failed", code: 63016, detail: "outside window" });
    expect(parseStatus({ MessageSid: "SM1", MessageStatus: "queued" })).toBeNull();
    expect(parseStatus({ MessageStatus: "sent" })).toBeNull();
  });
});

describe("sending", () => {
  const ok = () => vi.fn(async () => new Response(JSON.stringify({ sid: "SMabc" }), { status: 201 }));
  const call = (f: ReturnType<typeof ok>) => f.mock.calls[0] as unknown as [string, RequestInit];

  it("text: right URL, basic auth, form body, status callback", async () => {
    const f = ok();
    const r = await sendTwilioText(cfg, "919876543210", "Namaste", { statusCallback: "https://x.test/api/twilio/status" }, f as unknown as typeof fetch);
    expect(r.sid).toBe("SMabc");
    const [url, init] = call(f);
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json");
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from(`ACtest:${TOKEN}`).toString("base64")}`);
    const body = new URLSearchParams(init.body as string);
    expect(body.get("To")).toBe("whatsapp:+919876543210");
    expect(body.get("From")).toBe("whatsapp:+15550001111");
    expect(body.get("Body")).toBe("Namaste");
    expect(body.get("StatusCallback")).toBe("https://x.test/api/twilio/status");
  });
  it("media goes alone (no Body)", async () => {
    const f = ok();
    await sendTwilioMedia(cfg, "919876543210", "https://x.test/r/tok", {}, f as unknown as typeof fetch);
    const body = new URLSearchParams(call(f)[1].body as string);
    expect(body.get("MediaUrl")).toBe("https://x.test/r/tok");
    expect(body.has("Body")).toBe(false);
    expect(body.has("StatusCallback")).toBe(false);
  });
  it("maps Twilio error codes to owner-readable kinds and never leaks the token or number", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [code, kind] of [[63016, "window"], [63015, "not_allowed"], [63038, "rate"], [21654, "not_allowed"], [20003, "token"], [21211, "bad_number"]] as const) {
      const f = vi.fn(async () => new Response(JSON.stringify({ code, message: "to +919876543210" }), { status: 400 }));
      await expect(sendTwilioText(cfg, "919876543210", "x", {}, f as unknown as typeof fetch)).rejects.toMatchObject({ kind, code });
    }
    expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("9876543210");
    spy.mockRestore();
  });
  it("network failure is a WaError, not a crash", async () => {
    const f = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(sendTwilioText(cfg, "919876543210", "x", {}, f as unknown as typeof fetch)).rejects.toMatchObject({ kind: "other" });
  });
  it("classifyTwilio: 401 is a token problem, unknown is generic", () => {
    expect(classifyTwilio(null, 401).kind).toBe("token");
    expect(classifyTwilio(99999, 500).kind).toBe("other");
  });
  it("toWhatsApp", () => expect(toWhatsApp("91 98765-43210")).toBe("whatsapp:+919876543210"));
});

describe("fetchTwilioMedia", () => {
  it("downloads with auth from Twilio hosts and strips content-type params", async () => {
    const f = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/ogg; codecs=opus" } }));
    const r = await fetchTwilioMedia(cfg, "https://api.twilio.com/2010-04-01/Accounts/AC/Messages/MM/Media/ME", f as unknown as typeof fetch);
    expect(r.mime).toBe("audio/ogg");
    expect([...r.bytes]).toEqual([1, 2, 3]);
    expect(((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>).authorization).toMatch(/^Basic /);
  });
  it("refuses non-Twilio hosts (credentials never leave Twilio)", async () => {
    const f = vi.fn();
    await expect(fetchTwilioMedia(cfg, "https://evil.example.com/x", f as unknown as typeof fetch)).rejects.toThrow();
    await expect(fetchTwilioMedia(cfg, "https://twilio.com.evil.example/x", f as unknown as typeof fetch)).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
  it("rejects failed and oversize downloads", async () => {
    const bad = vi.fn(async () => new Response("no", { status: 404 }));
    await expect(fetchTwilioMedia(cfg, "https://api.twilio.com/x", bad as unknown as typeof fetch)).rejects.toThrow();
    const big = vi.fn(async () => new Response(new Uint8Array(20), { status: 200 }));
    await expect(fetchTwilioMedia(cfg, "https://api.twilio.com/x", big as unknown as typeof fetch, 10)).rejects.toThrow();
  });
});
