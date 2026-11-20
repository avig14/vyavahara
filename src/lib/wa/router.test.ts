/**
 * The whole WhatsApp conversation, end to end, with zero cost: in-memory DB layer, dry channel, fake AI ports.
 * Nothing here calls Twilio, Meta, Sarvam or Anthropic.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/client";
import { generateSnapshot } from "../seed/generate";
import type { Snapshot } from "../domain";

const NOW = new Date("2026-11-19T09:30:00Z"); // 15:00 IST, inside send hours
const PHONE = "919876543210";

const h = vi.hoisted(() => {
  type Alert = { id: string; subjectId: string; status: string; payload: unknown; createdAt: Date };
  const S = {
    merchant: { id: "", ownerPhoneWa: null as string | null, waConnectedAt: null as Date | null, waLastInboundAt: null as Date | null },
    settings: null as null | ((s: Snapshot["settings"]) => Snapshot["settings"]),
    session: { menuPath: "", context: null as unknown, updatedAt: null as Date | null },
    pending: [] as { id: string; kind: string; payload: unknown; status: string }[],
    alerts: [] as Alert[],
    seen: new Set<string>(),
    rows: [] as { id: string; kind: string; preview: string; status: string }[],
    applied: [] as { id: string; choice: number }[],
    khata: [] as unknown[],
  };
  return { S };
});

vi.mock("../db/queries", async () => {
  const { generateSnapshot: gen } = await import("../seed/generate");
  const base = gen({ now: new Date("2026-11-19T09:30:00Z") });
  const { S } = h;
  return {
    getMerchantByPhone: async (_d: unknown, phone: string) => (S.merchant.ownerPhoneWa === phone ? S.merchant : null),
    touchInbound: async (_d: unknown, _id: string, now: Date) => {
      S.merchant.waLastInboundAt = now;
      S.merchant.waConnectedAt ??= now;
    },
    claimInbound: async (_d: unknown, _id: string, wamid: string) => (S.seen.has(wamid) ? false : (S.seen.add(wamid), true)),
    loadSnapshot: async () => ({ ...base, settings: S.settings ? S.settings(base.settings) : base.settings, merchant: { ...base.merchant, ...S.merchant } }),
    getWaSession: async () => ({ ...S.session }),
    setWaSession: async (_d: unknown, _id: string, v: { menuPath: string; context: unknown }, now: Date) => void (S.session = { menuPath: v.menuPath, context: v.context ?? null, updatedAt: now }),
    getOpenPending: async () => S.pending.find((p) => p.status === "open") ?? null,
    createPendingAction: async (_d: unknown, _id: string, kind: string, payload: unknown) => {
      S.pending.forEach((p) => p.status === "open" && (p.status = "cancelled"));
      const row = { id: `pa${S.pending.length + 1}`, kind, payload, status: "open" };
      S.pending.push(row);
      return row;
    },
    resolvePending: async (_d: unknown, _id: string, id: string, status: string) => {
      const p = S.pending.find((x) => x.id === id);
      if (!p) return false;
      p.status = status;
      return true;
    },
    countOutboundSince: async () => S.rows.filter((r) => r.status !== "failed").length,
    startWaMessage: async (_d: unknown, _id: string, kind: string, preview: string) => {
      const row = { id: `w${S.rows.length + 1}`, kind, preview, status: "sending" };
      S.rows.push(row);
      return row.id;
    },
    markWaSent: async (_d: unknown, id: string) => void (S.rows.find((r) => r.id === id)!.status = "sent"),
    markWaFailed: async (_d: unknown, id: string) => void (S.rows.find((r) => r.id === id)!.status = "failed"),
    recentAlertFor: async (_d: unknown, _id: string, subjectId: string, since: Date) => S.alerts.find((a) => a.subjectId === subjectId && a.createdAt >= since && a.status !== "dismissed") ?? null,
    createAlert: async (_d: unknown, _id: string, subjectId: string, payload: unknown, status: string, now: Date) => {
      const a = { id: `al${S.alerts.length + 1}`, subjectId, status, payload, createdAt: now };
      S.alerts.push(a);
      return a;
    },
    queuedAlerts: async () => S.alerts.filter((a) => a.status === "queued"),
    setAlertStatus: async (_d: unknown, ids: string[], status: string) => void S.alerts.filter((a) => ids.includes(a.id)).forEach((a) => (a.status = status)),
    dismissQueuedFor: async (_d: unknown, _id: string, ids: string[]) => void S.alerts.filter((a) => a.status === "queued" && ids.includes(a.subjectId)).forEach((a) => (a.status = "dismissed")),
  };
});

vi.mock("../server/artifacts", () => ({
  baseUrl: () => "https://app.test",
  mintReportLink: async () => "https://app.test/r/tok",
  mintPayLink: async (_d: unknown, _id: string, a: { customerName: string; amountPaise: number }) => `https://app.test/pay/${a.customerName}-${a.amountPaise}`,
}));

vi.mock("../agent/store", () => ({
  dbStore: () => ({
    addKhataEntry: async (a: unknown) => void h.S.khata.push(a),
    createPurchaseOrder: async () => undefined,
  }),
}));

vi.mock("../agent/actions", async (orig) => {
  const real = await orig<typeof import("../agent/actions")>();
  return {
    ...real,
    applyChoice: async (_d: unknown, _id: string, row: { id: string }, choice: 1 | 2) => {
      h.S.applied.push({ id: row.id, choice });
      const p = h.S.pending.find((x) => x.id === row.id)!;
      p.status = choice === 1 ? "confirmed" : "cancelled";
      return choice === 1 ? "✅ Ho gaya." : "Theek hai, cancel kar diya.";
    },
  };
});

vi.mock("../ingest/bill-scan", () => ({
  scanBill: async () => ({
    pendingId: "pa-bill",
    expiresAt: null,
    review: { verdict: "ok", vendor: { name: "Sharma Traders" }, invoiceNo: "42", totalPaise: 120000, lines: [], unmatchedCount: 0, duplicate: false, problems: [] },
  }),
}));

import { checkKhataAlerts, alertText, redCandidates, takeQueuedAlerts } from "./alerts";
import { dryChannel, type Channel } from "./channel";
import { CONNECT_FIRST, handleInbound, routeMessage, type Ports } from "./router";

const db = {} as Db;
const snap0 = generateSnapshot({ now: NOW });
const suresh = redCandidates(snap0).find((c) => /Suresh/.test(c.payload.name))!;
const MID = snap0.merchant.id;

const ports = (over: Partial<Ports> = {}): Ports => ({
  transcribe: async () => "hi",
  classify: async () => "other",
  extractBill: async () => null,
  extractShot: async () => null,
  agent: async (_d, _m, text) => ({ text: `AGENT:${text}`, attachments: [] }) as never,
  agentReady: () => true,
  visionReady: () => true,
  ...over,
});

let seq = 0;
const msg = (text: string | null, media: { url: string; type: string } | null = null) => ({ id: `SM${++seq}`, from: PHONE, text, media });
const bodies = (ch: { outbox: { body: string }[] }) => ch.outbox.map((o) => o.body);
const last = (ch: { outbox: { body: string }[] }) => ch.outbox[ch.outbox.length - 1]?.body ?? "";

beforeEach(() => {
  const { S } = h;
  S.merchant = { id: MID, ownerPhoneWa: PHONE, waConnectedAt: new Date("2026-11-18T09:00:00Z"), waLastInboundAt: new Date("2026-11-19T09:00:00Z") };
  S.settings = null;
  S.session = { menuPath: "", context: null, updatedAt: null };
  S.pending = [];
  S.alerts = [];
  S.seen = new Set();
  S.rows = [];
  S.applied = [];
  S.khata = [];
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const say = async (ch: ReturnType<typeof dryChannel>, text: string | null, p = ports(), media: { url: string; type: string } | null = null, now = NOW) => {
  await handleInbound(db, ch, msg(text, media), p, now);
};

describe("front door", () => {
  it("unknown sender is told how to connect, nothing is logged or marked connected", async () => {
    const ch = dryChannel();
    await handleInbound(db, ch, { id: "SMx", from: "910000000000", text: "Hi", media: null }, ports(), NOW);
    expect(last(ch)).toBe(CONNECT_FIRST());
    expect(h.S.rows).toHaveLength(0);
    expect(h.S.seen.size).toBe(0);
  });

  it("first message connects the owner, says so, then answers", async () => {
    h.S.merchant.waConnectedAt = null;
    h.S.merchant.waLastInboundAt = null;
    const ch = dryChannel();
    await say(ch, "Hi");
    expect(bodies(ch)[0]).toMatch(/WhatsApp connect ho gaya/);
    // the red-khata alert found at connect time waits for this very first message, then the menu is one "0" away
    expect(bodies(ch)[1]).toMatch(/Khata alert/);
    expect(bodies(ch)[1]).toMatch(/Menu ke liye \*0\*/);
    expect(h.S.merchant.waConnectedAt).toEqual(NOW);
  });

  it("a retried webhook (same MessageSid) gets no second reply", async () => {
    const ch = dryChannel();
    const m = msg("Hi");
    await handleInbound(db, ch, m, ports(), NOW);
    await handleInbound(db, ch, m, ports(), NOW);
    expect(ch.outbox).toHaveLength(1);
  });

  it("never throws, even when the channel is dead", async () => {
    const dead: Channel = { ...dryChannel(), sendText: async () => { throw new Error("down"); } };
    await expect(handleInbound(db, dead, msg("Hi"), ports(), NOW)).resolves.toBeUndefined();
  });

  it("every outgoing message leaves a log row", async () => {
    const ch = dryChannel();
    await say(ch, "Hi");
    expect(h.S.rows.map((r) => r.kind)).toEqual(["menu"]);
    expect(h.S.rows[0].status).toBe("sent");
  });
});

describe("menu navigation", () => {
  it("Hi → main menu → 1 → module menu → leaf → 9 → main menu", async () => {
    const ch = dryChannel();
    await say(ch, "Hi");
    expect(last(ch)).toMatch(/Namaste/);
    await say(ch, "1");
    expect(last(ch)).toMatch(/STOCK/i);
    await say(ch, "3");
    expect(last(ch)).toMatch(/Maggi/);
    await say(ch, "9");
    expect(last(ch)).toMatch(/Namaste/);
    expect(h.S.session.menuPath).toBe("");
  });

  it("all five modules open from the main menu", async () => {
    const ch = dryChannel();
    for (const k of ["1", "2", "3", "4", "5"]) {
      await say(ch, "Hi");
      await say(ch, k);
      expect(last(ch)).not.toMatch(/Yeh option nahi/);
      expect(last(ch).length).toBeGreaterThan(40);
    }
  });

  it("bad digits are handled kindly, in the main menu and inside a module", async () => {
    const ch = dryChannel();
    await say(ch, "Hi");
    await say(ch, "8");
    expect(last(ch)).toMatch(/Yeh option nahi hai/);
    await say(ch, "1");
    await say(ch, "8");
    expect(last(ch)).toMatch(/Yeh option nahi hai/);
  });

  it("every leaf of every module answers over WhatsApp, under the message limit", async () => {
    const counts = { "1": 7, "2": 5, "3": 6, "4": 7, "5": 6 } as const;
    for (const [mod, n] of Object.entries(counts))
      for (let i = 1; i <= n; i++) {
        const ch = dryChannel();
        await say(ch, "Hi");
        await say(ch, mod);
        await say(ch, String(i));
        const text = last(ch);
        expect(text, `${mod}.${i}`).not.toMatch(/undefined|NaN|Kuch gadbad/);
        for (const o of ch.outbox) expect(o.body.length).toBeLessThanOrEqual(1500);
      }
  }, 180_000);
});

describe("steps that wait for an answer", () => {
  it("custom dates: asks, takes the range, shows a report", async () => {
    const ch = dryChannel();
    await say(ch, "Hi");
    await say(ch, "4");
    await say(ch, "4");
    expect(last(ch)).toMatch(/dates|date/i);
    await say(ch, "1/11 to 15/11");
    expect(last(ch).length).toBeGreaterThan(80);
    expect(h.S.session.context).toBeNull();
  });

  it("a stale step (over 30 min) is not treated as an answer", async () => {
    const ch = dryChannel();
    await say(ch, "Hi");
    await say(ch, "4");
    await say(ch, "4");
    const later = new Date(NOW.getTime() + 31 * 60_000);
    await say(ch, "1/11 to 15/11", ports({ agentReady: () => false }), null, later);
    expect(last(ch)).toMatch(/abhi nahi de sakta/);
  });

  it("udhaar to the red customer: parks a question, 1 does it, Hi cancels", async () => {
    const ch = dryChannel();
    await say(ch, "Hi");
    await say(ch, "3");
    await say(ch, "2");
    await say(ch, "Suresh 5000");
    expect(last(ch)).toMatch(/\*1\*/);
    expect(h.S.pending.at(-1)).toMatchObject({ kind: "udhaar", status: "open" });
    await say(ch, "1");
    expect(h.S.applied).toEqual([{ id: h.S.pending.at(-1)!.id, choice: 1 }]);
    expect(last(ch)).toMatch(/Ho gaya/);

    await say(ch, "Hi");
    await say(ch, "3");
    await say(ch, "2");
    await say(ch, "Suresh 4000");
    await say(ch, "Hi");
    expect(h.S.pending.at(-1)!.status).toBe("cancelled");
    expect(h.S.applied).toHaveLength(1);
  });

  it("2 declines a parked question", async () => {
    const ch = dryChannel();
    await say(ch, "Hi");
    await say(ch, "3");
    await say(ch, "2");
    await say(ch, "Suresh 5000");
    await say(ch, "2");
    expect(h.S.applied.at(-1)?.choice).toBe(2);
    expect(last(ch)).toMatch(/cancel/);
  });

  it("a payment is written straight away", async () => {
    const ch = dryChannel();
    await say(ch, "Hi");
    await say(ch, "3");
    await say(ch, "2");
    await say(ch, "Suresh 100 mila");
    expect(h.S.khata).toHaveLength(1);
    expect(last(ch)).toMatch(/mil gaye/);
  });

  it("1 with nothing waiting and no module open is just a menu digit, never a write", async () => {
    const ch = dryChannel();
    await say(ch, "1");
    expect(h.S.applied).toHaveLength(0);
    expect(last(ch)).toMatch(/STOCK/i);
  });
});

describe("voice, photos, PDF", () => {
  it("voice note → transcribed → handled like text, with the heard line first", async () => {
    const media = { "https://api.twilio.com/m/v": { bytes: new Uint8Array([1, 2, 3]), mime: "audio/ogg" } };
    const ch = dryChannel([], media);
    const transcribe = vi.fn(async () => "menu");
    await say(ch, null, ports({ transcribe }), { url: "https://api.twilio.com/m/v", type: "audio/ogg" });
    expect(transcribe).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), "audio/ogg");
    expect(bodies(ch).join("\n")).toMatch(/Suna: _“menu”_/);
    expect(bodies(ch).join("\n")).toMatch(/Namaste/);
  });

  it("empty or failed voice note → kind message, no crash", async () => {
    const ch = dryChannel([], { "https://api.twilio.com/m/v": { bytes: new Uint8Array([1]), mime: "audio/ogg" } });
    await say(ch, null, ports({ transcribe: async () => "  " }), { url: "https://api.twilio.com/m/v", type: "audio/ogg" });
    expect(last(ch)).toMatch(/Awaaz samajh nahi/);
    await say(ch, null, ports({ transcribe: async () => { throw new Error("sarvam down"); } }), { url: "https://api.twilio.com/m/v", type: "audio/ogg" });
    expect(last(ch)).toMatch(/Voice note abhi nahi sun paya/);
  });

  it("supplier bill photo → review with 1/2 (nothing saved until 1)", async () => {
    const ch = dryChannel([], { "https://api.twilio.com/m/i": { bytes: new Uint8Array([9, 9]), mime: "image/jpeg" } });
    await say(ch, null, ports({ classify: async () => "supplier_bill" }), { url: "https://api.twilio.com/m/i", type: "image/jpeg" });
    expect(last(ch)).toMatch(/Bill padha/);
    expect(last(ch)).toMatch(/\*1\*/);
  });

  it("payment screenshot: unreadable, and not found never says fraud", async () => {
    const media = { "https://api.twilio.com/m/s": { bytes: new Uint8Array([9]), mime: "image/png" } };
    const ch = dryChannel([], media);
    const m = { url: "https://api.twilio.com/m/s", type: "image/png" };
    await say(ch, null, ports({ classify: async () => "payment_screenshot", extractShot: async () => null }), m);
    expect(last(ch)).toMatch(/saaf nahi padh/);
    await say(ch, null, ports({ classify: async () => "payment_screenshot", extractShot: async () => ({ amount: 777777, utr: null, datetime: null }) as never }), m);
    expect(last(ch)).toMatch(/record mein nahi mila/);
    expect(last(ch)).not.toMatch(/fraud|fake|jhootha|dhokha/i);
  });

  it("menu 5.5 waits for a screenshot and treats the next photo as one without classifying", async () => {
    const media = { "https://api.twilio.com/m/s": { bytes: new Uint8Array([9]), mime: "image/png" } };
    const ch = dryChannel([], media);
    const classify = vi.fn(async () => "other" as const);
    await say(ch, "Hi");
    await say(ch, "5");
    await say(ch, "5");
    expect(h.S.session.context).toMatchObject({ kind: "screenshot" });
    await say(ch, null, ports({ classify, extractShot: async () => null }), { url: "https://api.twilio.com/m/s", type: "image/png" });
    expect(classify).not.toHaveBeenCalled();
    expect(h.S.session.context).toBeNull();
  });

  it("an unrelated photo, an unsupported format, and a missing AI key all get a clear answer", async () => {
    const media = {
      "https://api.twilio.com/m/a": { bytes: new Uint8Array([1]), mime: "image/jpeg" },
      "https://api.twilio.com/m/b": { bytes: new Uint8Array([1]), mime: "image/heic" },
    };
    const ch = dryChannel([], media);
    await say(ch, null, ports(), { url: "https://api.twilio.com/m/a", type: "image/jpeg" });
    expect(last(ch)).toMatch(/nahi lag raha/);
    await say(ch, null, ports(), { url: "https://api.twilio.com/m/b", type: "image/heic" });
    expect(last(ch)).toMatch(/JPG ya PNG/);
    await say(ch, null, ports({ visionReady: () => false }), { url: "https://api.twilio.com/m/a", type: "image/jpeg" });
    expect(last(ch)).toMatch(/band/);
  });

  it("a file we cannot read (pdf, video) is declined politely", async () => {
    const ch = dryChannel();
    await say(ch, null, ports(), { url: "https://api.twilio.com/m/p", type: "application/pdf" });
    expect(last(ch)).toMatch(/text, voice note aur photo/);
  });

  it("PDF bhejo → short text, then the file as its own message", async () => {
    const ch = dryChannel();
    await say(ch, "PDF bhejo");
    expect(ch.outbox.map((o) => o.kind)).toEqual(["text", "media"]);
    expect(ch.outbox[1].body).toBe("https://app.test/r/tok");
    expect(h.S.rows.map((r) => r.kind)).toEqual(["pdf", "pdf"]);
  });

  it("menu leaf with a PDF (3.? / 4.5) sends the file too; channel without media gets a link in text", async () => {
    const ch = dryChannel();
    await say(ch, "Hi");
    await say(ch, "4");
    await say(ch, "5");
    expect(ch.outbox.some((o) => o.kind === "media")).toBe(true);

    const noMedia = { ...dryChannel(), supportsMedia: false };
    await routeMessage(db, noMedia, MID, PHONE, { text: "PDF bhejo", media: null }, ports(), NOW);
    expect(noMedia.outbox.every((o) => o.kind === "text")).toBe(true);
    expect(bodies(noMedia).join("\n")).toContain("https://app.test/r/tok");
  });
});

describe("free text → agent", () => {
  it("goes to the agent with the owner's words; its PDF attachment is sent as a file", async () => {
    const ch = dryChannel();
    const agent = vi.fn(async () => ({ text: "Aaj ki sale ₹1,000", attachments: [{ period: "today" }] }) as never);
    await say(ch, "aaj ki sale kitni hui", ports({ agent }));
    expect(agent).toHaveBeenCalledTimes(1);
    expect(ch.outbox.map((o) => o.kind)).toEqual(["text", "media"]);
  });

  it("no AI key → honest fallback, agent not called", async () => {
    const ch = dryChannel();
    const agent = vi.fn();
    await say(ch, "aaj ki sale kitni hui", ports({ agent: agent as never, agentReady: () => false }));
    expect(agent).not.toHaveBeenCalled();
    expect(last(ch)).toMatch(/abhi nahi de sakta/);
  });

  it("an agent crash becomes a calm message, not silence", async () => {
    const ch = dryChannel();
    await say(ch, "kuch bhi poocho", ports({ agent: async () => { throw new Error("boom"); } }));
    expect(last(ch)).toMatch(/Kuch gadbad ho gayi/);
  });

  it("menu digits and words never reach the agent", async () => {
    const ch = dryChannel();
    const agent = vi.fn();
    const p = ports({ agent: agent as never });
    for (const t of ["Hi", "menu", "0", "1", "9", "PDF bhejo"]) await say(ch, t, p);
    expect(agent).not.toHaveBeenCalled();
  });
});

describe("red-khata alerts", () => {
  const snapFor = (over: Partial<Snapshot["merchant"]> = {}): Snapshot => ({ ...snap0, merchant: { ...snap0.merchant, ownerPhoneWa: PHONE, waConnectedAt: new Date("2026-11-18T09:00:00Z"), waLastInboundAt: new Date("2026-11-19T09:00:00Z"), ...over } });

  it("Suresh is the red customer in the demo data and the alert uses the PRD wording", () => {
    expect(suresh).toBeTruthy();
    const t = alertText(suresh.payload);
    expect(t).toMatch(/🔴 \*Khata alert:\* Suresh/);
    expect(t).toMatch(/\*1\* = Udhaar band karo/);
    expect(t).toMatch(/\*2\* = Reminder message banao/);
    expect(t).toMatch(/\*3\* = Ignore/);
  });

  it("window open + in hours → sent now, once; a second check respects the cool-down", async () => {
    const ch = dryChannel();
    const a = await checkKhataAlerts(db, MID, snapFor(), ch, NOW);
    expect(a.sentNow).toBe(1);
    expect(ch.outbox).toHaveLength(1);
    expect(h.S.session.context).toMatchObject({ kind: "alert", customerId: suresh.customerId });
    const b = await checkKhataAlerts(db, MID, snapFor(), ch, new Date(NOW.getTime() + 3_600_000));
    expect(b.created).toBe(0);
    expect(ch.outbox).toHaveLength(1);
  });

  it("owner can answer the live alert with 1 → block-credit question; reply 1 confirms", async () => {
    const ch = dryChannel();
    await checkKhataAlerts(db, MID, snapFor(), ch, NOW);
    await say(ch, "1");
    expect(h.S.pending.at(-1)).toMatchObject({ kind: "block_credit", status: "open" });
    await say(ch, "1");
    expect(h.S.applied.at(-1)?.choice).toBe(1);
  });

  it("outside send hours → queued, nothing sent", async () => {
    const ch = dryChannel();
    const late = new Date("2026-11-19T17:30:00Z"); // 23:00 IST
    const r = await checkKhataAlerts(db, MID, snapFor({ waLastInboundAt: new Date("2026-11-19T17:00:00Z") }), ch, late);
    expect(r).toMatchObject({ sentNow: 0 });
    expect(r.queued).toBeGreaterThan(0);
    expect(ch.outbox).toHaveLength(0);
  });

  it("24h window closed, not connected, or no channel → queued", async () => {
    for (const [over, chan] of [
      [{ waLastInboundAt: new Date("2026-11-17T09:00:00Z") }, dryChannel()],
      [{ waConnectedAt: null }, dryChannel()],
      [{}, null],
    ] as const) {
      h.S.alerts = [];
      const r = await checkKhataAlerts(db, MID, snapFor(over), chan, NOW);
      expect(r.sentNow).toBe(0);
      expect(r.queued).toBeGreaterThan(0);
    }
  });

  it("merchant switch off → nothing at all", async () => {
    const s = snapFor();
    s.settings = { ...s.settings, alerts: { ...s.settings.alerts, khataRed: false } };
    const ch = dryChannel();
    expect(await checkKhataAlerts(db, MID, s, ch, NOW)).toEqual({ created: 0, sentNow: 0, queued: 0 });
  });

  it("quiet hours come from settings, not code", async () => {
    const s = snapFor();
    s.settings = { ...s.settings, alerts: { ...s.settings.alerts, sendFromHour: 16, sendUntilHour: 20 } }; // 15:00 IST is now outside
    const ch = dryChannel();
    const r = await checkKhataAlerts(db, MID, s, ch, NOW);
    expect(r.sentNow).toBe(0);
  });

  it("a queued alert is shown on the owner's next message and then not again", async () => {
    await checkKhataAlerts(db, MID, snapFor({ waConnectedAt: null }), null, NOW);
    expect(h.S.alerts.some((a) => a.status === "queued")).toBe(true);
    const ch = dryChannel();
    await say(ch, "Hi");
    expect(bodies(ch).join("\n")).toMatch(/naya khata alert/);
    expect(h.S.alerts.some((a) => a.status === "queued")).toBe(false);
    expect(await takeQueuedAlerts(db, MID, NOW)).toBeNull();
    await say(ch, "3"); // ignore it
    expect(last(ch)).toMatch(/ignore/);
  });

  it("a queued alert for someone who is no longer red is dropped, not delivered", async () => {
    const calm = snap0.customers.find((c) => c.id !== suresh.customerId && !redCandidates(snap0).some((r) => r.customerId === c.id))!;
    h.S.alerts.push({ id: "old", subjectId: calm.id, status: "queued", payload: suresh.payload, createdAt: NOW });
    await checkKhataAlerts(db, MID, snapFor(), null, NOW);
    expect(h.S.alerts.find((a) => a.id === "old")?.status).toBe("dismissed");
  });

  it("first connect never sends the alert twice", async () => {
    h.S.merchant.waConnectedAt = null;
    h.S.merchant.waLastInboundAt = null;
    const ch = dryChannel();
    await say(ch, "Hi");
    expect(bodies(ch).filter((b) => /Khata alert/.test(b))).toHaveLength(1);
    await say(ch, "0");
    expect(last(ch)).toMatch(/Namaste/);
  });
});
