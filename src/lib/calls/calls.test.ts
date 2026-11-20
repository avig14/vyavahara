import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, applySettingsPatch } from "../settings";
import type { Snapshot } from "../domain";
import { selectCallCandidates, inCallingHours } from "./select";
import { normalizeIndianPhone, vobizConfig, placeCall, speak } from "./vobiz";
import { answerXml, outcomeFor, spokenAmount } from "./script";
import { webhookAuthorized, cronAuthorized } from "./webhook";

const NOW = new Date("2026-11-20T06:30:00Z"); // 12:00 IST
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function snap(over: Record<string, unknown> = {}, calls: Record<string, unknown> = {}): Snapshot {
  const settings = { ...DEFAULT_SETTINGS, calls: { ...DEFAULT_SETTINGS.calls, enabled: true, ...calls } };
  return {
    now: NOW,
    settings,
    merchant: { id: "m", name: "Gupta Kirana" },
    customers: [
      { id: "old", name: "Sharma ji", creditLimitPaise: 500000, creditBlocked: false, vpaHash: null, createdAt: day(200), phone: "919876543210", callConsent: true, ...over },
      { id: "new", name: "Verma ji", creditLimitPaise: 500000, creditBlocked: false, vpaHash: null, createdAt: day(200), phone: "919811111111", callConsent: true },
    ],
    transactions: [],
    khata: [
      { id: "k1", customerId: "old", type: "credit", amountPaise: 120000, createdAt: day(45) },
      { id: "k2", customerId: "new", type: "credit", amountPaise: 90000, createdAt: day(5) },
    ],
  } as unknown as Snapshot;
}

describe("selectCallCandidates", () => {
  it("calls only customers past the overdue threshold", () => {
    const r = selectCallCandidates(snap(), [], NOW);
    expect(r.candidates.map((c) => c.name)).toEqual(["Sharma ji"]);
    expect(r.candidates[0].overdueDays).toBe(45);
    expect(r.skipped.find((s) => s.name === "Verma ji")?.reason).toMatch(/threshold/);
  });
  it("threshold is tunable", () => {
    expect(selectCallCandidates(snap({}, { minOverdueDays: 60 }), [], NOW).candidates).toHaveLength(0);
    expect(selectCallCandidates(snap({}, { minOverdueDays: 3 }), [], NOW).candidates).toHaveLength(2);
  });
  it("is off by default", () => {
    const s = snap();
    s.settings.calls.enabled = false;
    expect(selectCallCandidates(s, [], NOW).candidates).toHaveLength(0);
  });
  it("never calls without consent or a phone", () => {
    expect(selectCallCandidates(snap({ callConsent: false }), [], NOW).skipped[0].reason).toBe("no call consent");
    expect(selectCallCandidates(snap({ phone: null }), [], NOW).skipped[0].reason).toBe("no phone number");
  });
  it("respects calling hours", () => {
    const night = new Date("2026-11-20T17:00:00Z"); // 22:30 IST
    expect(selectCallCandidates(snap(), [], night).candidates).toHaveLength(0);
    expect(inCallingHours(NOW, 10, 19)).toBe(true);
    expect(inCallingHours(night, 10, 19)).toBe(false);
  });
  it("respects retry gap, max attempts and promises", () => {
    const att = (n: number, outcome: string | null = null) => ({ customerId: "old", createdAt: day(n), outcome });
    expect(selectCallCandidates(snap(), [att(1)], NOW).candidates).toHaveLength(0);
    expect(selectCallCandidates(snap(), [att(4)], NOW).candidates).toHaveLength(1);
    expect(selectCallCandidates(snap(), [att(4), att(8), att(12)], NOW).candidates).toHaveLength(0);
    expect(selectCallCandidates(snap(), [att(4, "will_pay")], NOW).candidates).toHaveLength(0);
    expect(selectCallCandidates(snap(), [att(9, "will_pay")], NOW).candidates).toHaveLength(1);
  });
});

describe("settings.calls", () => {
  it("defaults to off and rejects a backwards calling window", () => {
    expect(DEFAULT_SETTINGS.calls.enabled).toBe(false);
    expect(applySettingsPatch(DEFAULT_SETTINGS, { calls: { fromHour: 19, untilHour: 12 } }).ok).toBe(false);
    expect(applySettingsPatch(DEFAULT_SETTINGS, { calls: { enabled: true, minOverdueDays: 45 } }).ok).toBe(true);
  });
});

describe("vobiz", () => {
  it("normalizes Indian numbers", () => {
    expect(normalizeIndianPhone("98765 43210")).toBe("919876543210");
    expect(normalizeIndianPhone("+91-98765-43210")).toBe("919876543210");
    expect(normalizeIndianPhone("09876543210")).toBe("919876543210");
    expect(normalizeIndianPhone("12345")).toBeNull();
    expect(normalizeIndianPhone("5876543210")).toBeNull();
  });
  it("config needs id, token and a valid caller number", () => {
    expect(vobizConfig({})).toBeNull();
    const c = vobizConfig({ VOBIZ_AUTH_ID: "MA_1", VOBIZ_AUTH_TOKEN: "t", VOBIZ_FROM_NUMBER: "+91 80 6555 1234" });
    expect(c?.from).toBe("918065551234");
  });
  it("places a call with the documented request", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ message: "Call fired", request_uuid: "u-1" }), { status: 200 });
    }) as unknown as typeof fetch;
    const cfg = { authId: "MA_1", authToken: "tok", from: "919800000000", baseUrl: "https://api.vobiz.ai", mode: "live" as const };
    const r = await placeCall(cfg, { to: "919876543210", answerUrl: "https://x/a", hangupUrl: "https://x/h" }, f);
    expect(r).toEqual({ ok: true, callUuid: "u-1" });
    expect(seen!.url).toBe("https://api.vobiz.ai/api/v1/Account/MA_1/Call/");
    expect((seen!.init.headers as Record<string, string>)["X-Auth-Token"]).toBe("tok");
    expect(JSON.parse(seen!.init.body as string)).toMatchObject({ from: "919800000000", to: "919876543210", answer_url: "https://x/a", answer_method: "POST" });
  });
  it("reports API errors and never calls in dry mode", async () => {
    const f = (async () => new Response(JSON.stringify({ error: "insufficient balance" }), { status: 402 })) as unknown as typeof fetch;
    const cfg = { authId: "MA_1", authToken: "t", from: "919800000000", baseUrl: "https://api.vobiz.ai", mode: "live" as const };
    expect(await placeCall(cfg, { to: "1", answerUrl: "a", hangupUrl: "h" }, f)).toMatchObject({ ok: false, status: 402 });
    const dry = await placeCall({ ...cfg, mode: "dry" }, { to: "919876543210", answerUrl: "a", hangupUrl: "h" }, (() => { throw new Error("no network in dry mode"); }) as unknown as typeof fetch);
    expect(dry.ok).toBe(true);
  });
  it("escapes XML", () => {
    expect(speak('a & <b> "c"')).toContain("a &amp; &lt;b&gt; &quot;c&quot;");
  });
});

describe("script", () => {
  const f = { customerName: "Sharma ji", shopName: "Gupta Kirana", amountPaise: 120000, overdueDays: 45 };
  it("reads exact numbers from code", () => {
    expect(spokenAmount(120000)).toBe("1200 rupaye");
    const x = answerXml(f, "https://x/g?attempt=1&k=s");
    expect(x).toContain("1200 rupaye");
    expect(x).toContain("45 din");
    expect(x).toContain("attempt=1&amp;k=s");
    expect(x).toContain("<Gather");
  });
  it("maps keypresses", () => {
    expect(outcomeFor("1")).toBe("will_pay");
    expect(outcomeFor("2")).toBe("call_back");
    expect(outcomeFor("3")).toBe("no_response");
    expect(outcomeFor(undefined)).toBe("no_response");
  });
});

describe("webhook auth", () => {
  it("needs a configured secret and a matching key", () => {
    const req = (u: string, h: Record<string, string> = {}) => new Request(u, { headers: h });
    expect(webhookAuthorized(req("https://x/a?k=s"), {})).toBe(false);
    expect(webhookAuthorized(req("https://x/a?k=s"), { VOBIZ_WEBHOOK_SECRET: "s" })).toBe(true);
    expect(webhookAuthorized(req("https://x/a?k=bad"), { VOBIZ_WEBHOOK_SECRET: "s" })).toBe(false);
    expect(cronAuthorized(req("https://x", { authorization: "Bearer c" }), { CALLS_CRON_SECRET: "c" })).toBe(true);
    expect(cronAuthorized(req("https://x"), { CALLS_CRON_SECRET: "c" })).toBe(false);
  });
});

import { mentionsCall, parseCallRequest } from "./voice-intent";
import { confirmationMessage, executePending } from "../agent/actions";

describe("voice: call request", () => {
  const acc = [
    { customerId: "a", name: "Suresh Patel", outstandingPaise: 240000, oldestUnpaidDays: 52 },
    { customerId: "b", name: "Pooja Sharma", outstandingPaise: 90000, oldestUnpaidDays: 20 },
    { customerId: "c", name: "Rakesh Sharma", outstandingPaise: 50000, oldestUnpaidDays: 40 },
  ];
  it("finds one customer by first or last name", () => {
    expect(parseCallRequest("Suresh ji ko reminder call karo", acc)).toMatchObject({ kind: "one", account: { customerId: "a" } });
    expect(parseCallRequest("patel ko phone lagao", acc)).toMatchObject({ kind: "one", account: { customerId: "a" } });
  });
  it("asks which one when the name is shared", () => {
    expect(parseCallRequest("sharma ji ko call karo", acc)).toMatchObject({ kind: "ambiguous" });
  });
  it("asks for a name, and ignores unrelated talk", () => {
    expect(parseCallRequest("ek reminder call lagao", acc).kind).toBe("nameless");
    expect(parseCallRequest("aaj ki sale kitni hui", acc).kind).toBe("none");
    expect(mentionsCall("aaj ki sale kitni hui")).toBe(false);
    expect(parseCallRequest("kya koi call aayi thi", acc).kind).toBe("none");
  });
});

describe("call_customer pending action", () => {
  const p = { kind: "call_customer" as const, customerId: "a", name: "Suresh Patel", amountPaise: 240000, overdueDays: 52 };
  it("asks, then dials through the store", async () => {
    expect(confirmationMessage(p)).toContain("52 din");
    const store = { callCustomer: async () => ({ ok: true as const, name: "Suresh Patel", amountPaise: 240000 }) } as never;
    expect(await executePending(store, p)).toContain("reminder call lag rahi hai");
    const refused = { callCustomer: async () => ({ ok: false as const, message: "Phone number save nahi hai." }) } as never;
    expect(await executePending(refused, p)).toBe("Phone number save nahi hai.");
  });
});

import { numberAllowed } from "./dial";
describe("demo allowlist", () => {
  it("is open when unset and strict when set", () => {
    expect(numberAllowed("919876543210", {})).toBe(true);
    const env = { CALLS_ALLOWED_NUMBERS: "98765 43210, +91 98765 00001" };
    expect(numberAllowed("919876543210", env)).toBe(true);
    expect(numberAllowed("919876500001", env)).toBe(true);
    expect(numberAllowed("919000000000", env)).toBe(false);
  });
});
