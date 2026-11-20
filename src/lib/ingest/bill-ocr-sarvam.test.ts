import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { billFromSarvam, extractBillSarvam, isoDate } from "./bill-ocr-sarvam";
import { billReader } from "./vision";

const IMG = { base64: Buffer.from("fake").toString("base64"), mime: "image/jpeg" as const };
const RESULT = {
  vendor_name: "SHREE SWEETS WHOLESALE",
  invoice_no: "SSW/2411/0387",
  invoice_date: "20-11-2026",
  items: [
    { name: "Kaju Katli 250g", qty: 24, unit_price: 250, line_total: 6000 },
    { name: "Cashew (Kaju) 250g", qty: 18, unit_price: 270, line_total: 4860 },
    { name: "No qty", unit_price: 1 },
  ],
  total: 11960,
};
const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("isoDate", () => {
  it("reads Indian and ISO dates", () => {
    expect(isoDate("20-11-2026")).toBe("2026-11-20");
    expect(isoDate("5/1/26")).toBe("2026-01-05");
    expect(isoDate("2026-11-20")).toBe("2026-11-20");
  });
  it("rejects junk", () => {
    expect(isoDate("32-13-2026")).toBeNull();
    expect(isoDate("yesterday")).toBeNull();
    expect(isoDate(null)).toBeNull();
  });
});

describe("billFromSarvam", () => {
  it("maps fields, converts the date, drops lines without a qty", () => {
    const b = billFromSarvam(RESULT)!;
    expect(b.vendor_name).toBe("SHREE SWEETS WHOLESALE");
    expect(b.invoice_date).toBe("2026-11-20");
    expect(b.items.map((x) => x.name)).toEqual(["Kaju Katli 250g", "Cashew (Kaju) 250g"]);
    expect(b.total).toBe(11960);
  });
  it("gives null for a non-object", () => {
    expect(billFromSarvam(null)).toBeNull();
  });
});

describe("extractBillSarvam", () => {
  beforeEach(() => {
    process.env.SARVAM_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.SARVAM_API_KEY;
  });

  it("submits, polls, then reads the result", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push(`${init?.method ?? "GET"} ${u.replace("https://api.sarvam.ai", "")}`);
      expect((init?.headers as Record<string, string>)["api-subscription-key"]).toBe("test-key");
      if (u.endsWith("/extract")) return res({ job_id: "j1", status: "pending" }, 201);
      if (u.endsWith("/status")) return res({ status: calls.filter((c) => c.endsWith("/status")).length < 2 ? "running" : "completed" });
      return res({ result: RESULT });
    });
    const b = await extractBillSarvam(IMG, { pollMs: 0, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(b?.items).toHaveLength(2);
    expect(calls).toEqual([
      "POST /doc-ai/v1/job/extract",
      "GET /doc-ai/v1/job/j1/status",
      "GET /doc-ai/v1/job/j1/status",
      "GET /doc-ai/v1/job/j1/results",
    ]);
  });

  it("returns null when the job fails (owner retakes the photo)", async () => {
    const fetchImpl = async (url: string | URL | Request) => (String(url).endsWith("/extract") ? res({ job_id: "j2" }, 201) : res({ status: "failed" }));
    expect(await extractBillSarvam(IMG, { pollMs: 0, fetchImpl: fetchImpl as unknown as typeof fetch })).toBeNull();
  });

  it("throws on a service error", async () => {
    const fetchImpl = async () => res({ detail: "nope" }, 402);
    await expect(extractBillSarvam(IMG, { pollMs: 0, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(/402/);
  });

  it("times out instead of hanging", async () => {
    const fetchImpl = async (url: string | URL | Request) => (String(url).endsWith("/extract") ? res({ job_id: "j3" }, 201) : res({ status: "running" }));
    await expect(extractBillSarvam(IMG, { pollMs: 0, timeoutMs: -1, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(/timed out/);
  });
});

describe("billReader", () => {
  const keep = { ...process.env };
  afterEach(() => {
    process.env = { ...keep };
  });
  it("prefers Sarvam, falls back to Claude, null when neither", () => {
    delete process.env.BILL_OCR;
    process.env.SARVAM_API_KEY = "s";
    process.env.ANTHROPIC_API_KEY = "a";
    expect(billReader()).toBe("sarvam");
    delete process.env.SARVAM_API_KEY;
    expect(billReader()).toBe("claude");
    delete process.env.ANTHROPIC_API_KEY;
    expect(billReader()).toBeNull();
  });
  it("BILL_OCR=claude forces Claude", () => {
    process.env.SARVAM_API_KEY = "s";
    process.env.ANTHROPIC_API_KEY = "a";
    process.env.BILL_OCR = "claude";
    expect(billReader()).toBe("claude");
  });
});
