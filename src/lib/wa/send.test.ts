import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSnapshot } from "../seed/generate";
import type { Db } from "../db/client";

const log: string[] = [];
let phone: string | null = "919876543210";

vi.mock("../db/queries", () => ({
  getWaState: async () => ({ ownerName: "x", phone, connectedAt: null, lastInboundAt: null }),
  loadSnapshot: async () => generateSnapshot({ now: new Date("2026-11-19T09:30:00Z") }),
  startWaMessage: async (_d: unknown, _m: string, kind: string) => (log.push(`start:${kind}`), `row-${log.length}`),
  markWaSent: async (_d: unknown, id: string, wamid: string) => void log.push(`sent:${id}:${wamid}`),
  markWaFailed: async (_d: unknown, id: string, code: number | null) => void log.push(`failed:${id}:${code}`),
}));

import { intentOf } from "./router";
import { sendReportToOwner, windowOpenUntil } from "./send";

const cfg = { token: "T", phoneNumberId: "1", version: "v27.0" };
const db = {} as Db;
const ok = (n = { v: 0 }) => vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: `w${++n.v}` }] }), { status: 200 })) as unknown as typeof fetch;
const err = (code: number) => new Response(JSON.stringify({ error: { code } }), { status: 400 });

beforeEach(() => {
  log.length = 0;
  phone = "919876543210";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("sendReportToOwner", () => {
  it("logs sending first, then sent with the wamid", async () => {
    const r = await sendReportToOwner(db, "m", cfg, { fetch: ok() });
    expect(r).toMatchObject({ ok: true, kind: "report", to: "91••••••3210" });
    expect(log[0]).toBe("start:report");
    expect(log[1]).toMatch(/^sent:row-1:w\d+$/);
  });

  it("no number saved → clear refusal, nothing sent", async () => {
    phone = null;
    const f = ok();
    expect(await sendReportToOwner(db, "m", cfg, { fetch: f })).toMatchObject({ ok: false, reason: "no_number" });
    expect(f).not.toHaveBeenCalled();
  });

  it("window closed → report marked failed, hello_world template sent, owner told to reply Hi", async () => {
    let n = 0;
    const f = vi.fn(async () => (n++ === 0 ? err(131047) : new Response(JSON.stringify({ messages: [{ id: "wT" }] }), { status: 200 }))) as unknown as typeof fetch;
    const r = await sendReportToOwner(db, "m", cfg, { fetch: f });
    expect(r).toMatchObject({ ok: true, kind: "template" });
    expect((r as { notice: string }).notice).toMatch(/Hi/);
    expect(log).toEqual(["start:report", "failed:row-1:131047", "start:template", "sent:row-3:wT"]);
    expect(JSON.parse((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[1][1].body as string).template.name).toBe("hello_world");
  });

  it("number not on the test list → failed with the action to take", async () => {
    const f = vi.fn(async () => err(131030)) as unknown as typeof fetch;
    const r = await sendReportToOwner(db, "m", cfg, { fetch: f });
    expect(r).toMatchObject({ ok: false, reason: "wa_error", errorKind: "not_allowed" });
    expect((r as { message: string }).message).toMatch(/API Setup/);
    expect(log).toEqual(["start:report", "failed:row-1:131030"]);
  });

  it("expired token → failed, no template attempt", async () => {
    const f = vi.fn(async () => err(190)) as unknown as typeof fetch;
    expect(await sendReportToOwner(db, "m", cfg, { fetch: f })).toMatchObject({ ok: false, errorKind: "token" });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("24h window", () => {
  const now = new Date("2026-11-19T12:00:00Z");
  it("open for 24h after the owner's last message, closed after", () => {
    expect(windowOpenUntil(null, now)).toBeNull();
    expect(windowOpenUntil(new Date("2026-11-19T00:00:00Z"), now)?.toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect(windowOpenUntil(new Date("2026-11-18T11:59:00Z"), now)).toBeNull();
  });
});

describe("inbound intent", () => {
  it("greetings and empty input open the menu", () => {
    for (const t of ["Hi", "hello", "Namaste", "menu", "HELP", "0", "", "  "]) expect(intentOf(t)).toBe("menu");
  });
  it("menu digits and words pick the canned answers", () => {
    expect(["1", "2", "3", "4", "5"].map((t) => intentOf(t))).toEqual(["report", "stock", "khata", "suppliers", "pdf"]);
    expect(intentOf("PDF")).toBe("pdf");
    expect(intentOf("udhaar")).toBe("khata");
  });
  it("a tapped list reply wins over the text", () => expect(intentOf(null, "2")).toBe("stock"));
  it("anything else goes to the agent", () => expect(intentOf("aaj kitni sale hui?")).toBe("agent"));
});
