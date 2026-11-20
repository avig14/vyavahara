/** Signed fake Twilio POSTs against the real route handlers. No network, no DB, no AI. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import twilio from "twilio";

const handled: unknown[] = [];
const statuses: unknown[][] = [];
let flushes = 0;

vi.mock("next/server", () => ({ after: (fn: () => unknown) => void pending.push(Promise.resolve(fn())) }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}), flushWrites: async () => void flushes++ }));
vi.mock("@/lib/wa/router", () => ({ handleInbound: async (_d: unknown, _c: unknown, m: unknown) => void handled.push(m) }));
vi.mock("@/lib/db/queries", () => ({ applyWaStatus: async (...a: unknown[]) => void statuses.push(a.slice(1)) }));

const pending: Promise<unknown>[] = [];
const TOKEN = "route-test-token";
const BASE = "https://vyavahara.example.test";
const env = { ...process.env };

import { POST as inbound } from "./webhook/route";
import { POST as status } from "./status/route";

function signed(path: string, fields: Record<string, string>, opts: { token?: string; url?: string; sign?: boolean } = {}) {
  const url = opts.url ?? `${BASE}${path}`;
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (opts.sign !== false) headers["x-twilio-signature"] = twilio.getExpectedTwilioSignature(opts.token ?? TOKEN, url, fields);
  return new Request(`http://internal.local${path}`, { method: "POST", headers, body: new URLSearchParams(fields).toString() });
}

const msg = { MessageSid: "SM1", From: "whatsapp:+919876543210", To: "whatsapp:+17372508034", Body: "Hi", NumMedia: "0" };

beforeEach(() => {
  handled.length = 0;
  flushes = 0;
  statuses.length = 0;
  pending.length = 0;
  Object.assign(process.env, { TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: TOKEN, TWILIO_WHATSAPP_FROM: "+17372508034", DATABASE_URL: "postgres://fake", APP_BASE_URL: BASE, TWILIO_SEND_MODE: "dry" });
});
afterEach(() => {
  for (const k of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "DATABASE_URL", "APP_BASE_URL", "TWILIO_SEND_MODE"]) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
});

describe("POST /api/twilio/webhook", () => {
  it("valid signature → empty 200 right away, message handed to the router", async () => {
    const res = await inbound(signed("/api/twilio/webhook", msg));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    await Promise.all(pending);
    expect(handled).toEqual([{ id: "SM1", from: "919876543210", text: "Hi", media: null, profileName: null }]);
    expect(flushes).toBe(1); // data-version bump runs once after the reply work
  });

  it("voice note fields reach the router as media", async () => {
    await inbound(signed("/api/twilio/webhook", { ...msg, Body: "", NumMedia: "1", MediaUrl0: "https://api.twilio.com/m/1", MediaContentType0: "audio/ogg" }));
    await Promise.all(pending);
    expect(handled[0]).toMatchObject({ text: null, media: { url: "https://api.twilio.com/m/1", type: "audio/ogg" } });
  });

  it("bad, missing or wrong-token signature → 401 and the router is never called", async () => {
    for (const r of [signed("/api/twilio/webhook", msg, { token: "other" }), signed("/api/twilio/webhook", msg, { sign: false }), signed("/api/twilio/webhook", msg, { url: `${BASE}/elsewhere` })]) {
      expect((await inbound(r)).status).toBe(401);
    }
    await Promise.all(pending);
    expect(handled).toHaveLength(0);
  });

  it("a tampered body fails the signature", async () => {
    const good = signed("/api/twilio/webhook", msg);
    const tampered = new Request(good.url, { method: "POST", headers: good.headers, body: new URLSearchParams({ ...msg, Body: "delete everything" }).toString() });
    expect((await inbound(tampered)).status).toBe(401);
    expect(handled).toHaveLength(0);
  });

  it("not configured → 503; no database → 503", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    expect((await inbound(signed("/api/twilio/webhook", msg))).status).toBe(503);
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    process.env.DATABASE_URL = "";
    expect((await inbound(signed("/api/twilio/webhook", msg))).status).toBe(503);
  });

  it("a non-WhatsApp or malformed post is accepted (200) but ignored, so Twilio does not retry forever", async () => {
    const res = await inbound(signed("/api/twilio/webhook", { MessageSid: "SM9", From: "+919876543210", Body: "sms" }));
    expect(res.status).toBe(200);
    await Promise.all(pending);
    expect(handled).toHaveLength(0);
  });
});

describe("POST /api/twilio/status", () => {
  it("applies delivery receipts", async () => {
    expect((await status(signed("/api/twilio/status", { MessageSid: "SM5", MessageStatus: "delivered" }))).status).toBe(200);
    expect((await status(signed("/api/twilio/status", { MessageSid: "SM6", MessageStatus: "failed", ErrorCode: "63016", ChannelStatusMessage: "outside window" }))).status).toBe(200);
    expect(statuses).toEqual([
      ["SM5", "delivered", null, null],
      ["SM6", "failed", 63016, "outside window"],
    ]);
  });

  it("ignores in-flight statuses, rejects unsigned posts", async () => {
    expect((await status(signed("/api/twilio/status", { MessageSid: "SM5", MessageStatus: "queued" }))).status).toBe(200);
    expect(statuses).toHaveLength(0);
    expect((await status(signed("/api/twilio/status", { MessageSid: "SM5", MessageStatus: "read" }, { sign: false }))).status).toBe(401);
    expect(statuses).toHaveLength(0);
  });
});
