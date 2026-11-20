import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/client";

const log: string[] = [];
let used = 0;

vi.mock("../db/queries", () => ({
  countOutboundSince: async () => used,
  startWaMessage: async (_d: unknown, _m: string, kind: string, preview: string) => (log.push(`start:${kind}:${preview}`), `row-${log.length}`),
  markWaSent: async (_d: unknown, id: string, wamid: string) => void log.push(`sent:${id}:${wamid}`),
  markWaFailed: async (_d: unknown, id: string, code: number | null) => void log.push(`failed:${id}:${code}`),
}));

import { activeProvider, deliver, dryChannel, pickChannel, statusCallbackUrl, TWILIO_MAX_TEXT, type Channel } from "./channel";
import { WaError } from "./cloud";

const db = {} as Db;
const NOW = new Date("2026-11-19T09:30:00Z");
const TW = { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_WHATSAPP_FROM: "+17372508034" };

beforeEach(() => {
  log.length = 0;
  used = 0;
});

describe("deliver", () => {
  it("one log row per message, in order, text then media", async () => {
    const ch = dryChannel();
    const r = await deliver(db, ch, "m", "919876543210", [{ text: "Hello" }, { mediaUrl: "https://x.test/r/t", label: "📄 PDF" }], "pdf", NOW);
    expect(r).toEqual({ sent: 2, error: null });
    expect(ch.outbox.map((o) => o.kind)).toEqual(["text", "media"]);
    expect(log).toEqual(["start:pdf:Hello", "sent:row-1:dry-1", "start:pdf:📄 PDF", "sent:row-3:dry-2"]);
  });

  it("long text is split under the Twilio limit, nothing lost", async () => {
    const ch = dryChannel();
    const long = Array.from({ length: 120 }, (_, i) => `Line ${i} ${"x".repeat(40)}`).join("\n");
    const r = await deliver(db, ch, "m", "919876543210", [{ text: long }], "reply", NOW);
    expect(r.sent).toBeGreaterThan(1);
    for (const o of ch.outbox) expect(o.body.length).toBeLessThanOrEqual(TWILIO_MAX_TEXT);
    expect(ch.outbox.map((o) => o.body).join("\n")).toContain("Line 119");
    expect(ch.outbox.map((o) => o.body).join("\n")).toContain("Line 0 ");
  });

  it("stops at the first failure so replies never arrive out of order", async () => {
    let n = 0;
    const ch: Channel = {
      ...dryChannel(),
      sendText: async () => {
        if (++n === 2) throw new WaError("window closed", "window", 63016, 400);
        return `id${n}`;
      },
    };
    const r = await deliver(db, ch, "m", "919876543210", [{ text: "a" }, { text: "b" }, { text: "c" }], "reply", NOW);
    expect(r).toEqual({ sent: 1, error: { message: "window closed", code: 63016 } });
    expect(log).toEqual(["start:reply:a", "sent:row-1:id1", "start:reply:b", "failed:row-3:63016"]);
  });

  it("an unexpected error is logged generically, not leaked", async () => {
    const ch: Channel = {
      ...dryChannel(),
      sendText: async () => {
        throw new Error("secret detail");
      },
    };
    const r = await deliver(db, ch, "m", "919876543210", [{ text: "a" }], "reply", NOW);
    expect(r.error?.message).toBe("Unexpected error");
  });

  it("daily cap: nothing is sent once the budget is used, row says 63038", async () => {
    used = 40;
    const ch = { ...dryChannel(), dailyCap: 40 };
    const r = await deliver(db, ch, "m", "919876543210", [{ text: "a" }], "reply", NOW);
    expect(r.sent).toBe(0);
    expect(r.error?.code).toBe(63038);
    expect(ch.outbox).toHaveLength(0);
    expect(log).toEqual(["start:reply:a", "failed:row-1:63038"]);
  });

  it("daily cap counts messages sent in this very call", async () => {
    used = 39;
    const ch = { ...dryChannel(), dailyCap: 40 };
    const r = await deliver(db, ch, "m", "919876543210", [{ text: "a" }, { text: "b" }], "reply", NOW);
    expect(r.sent).toBe(1);
    expect(r.error?.code).toBe(63038);
  });
});

describe("provider choice", () => {
  it("twilio wins when configured, dry mode never calls out", () => {
    expect(activeProvider(TW)).toBe("twilio");
    expect(pickChannel(TW)?.name).toBe("twilio");
    expect(pickChannel({ ...TW, TWILIO_SEND_MODE: "dry" })?.name).toBe("dry");
  });
  it("meta when only Meta vars are set, null when nothing", () => {
    const meta = { WHATSAPP_ACCESS_TOKEN: "T", WHATSAPP_PHONE_NUMBER_ID: "1" };
    expect(activeProvider(meta)).toBe("meta");
    expect(pickChannel(meta)?.name).toBe("meta");
    expect(activeProvider({})).toBeNull();
    expect(pickChannel({})).toBeNull();
  });
  it("status callback only for a public https host", () => {
    expect(statusCallbackUrl({ APP_BASE_URL: "https://vyavahara.vercel.app/" })).toBe("https://vyavahara.vercel.app/api/twilio/status");
    expect(statusCallbackUrl({ APP_BASE_URL: "http://localhost:3000" })).toBeNull();
    expect(statusCallbackUrl({})).toBeNull();
  });
});
