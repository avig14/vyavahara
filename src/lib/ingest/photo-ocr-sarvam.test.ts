import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _clearReadCache, extractBillSarvam, imageReadFromSarvam, isoDateTimeIST, readImageSarvam, shotFromSarvam } from "./bill-ocr-sarvam";
import { classifyImage, extractBill, extractPaymentShot } from "./vision";

const BILL = {
  vendor_name: "SHREE SWEETS WHOLESALE",
  invoice_no: "SSW/2411/0387",
  invoice_date: "20-11-2026",
  items: [
    { name: "Kaju Katli 250g", qty: 24, unit_price: 250, line_total: 6000 },
    { name: "Cashew (Kaju) 250g", qty: 18, unit_price: 270, line_total: 4860 },
  ],
  total: 11960,
};
const SHOT = { document_type: "payment_screenshot", pay_amount: 1250, pay_utr: "412345678901", pay_datetime: "20 Nov 2026, 3:45 PM", pay_payee: "Gupta General Store", pay_app: "PhonePe" };
const BILL_DOC = { document_type: "supplier_bill", ...BILL };

const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const img = (t: string) => ({ base64: Buffer.from(t).toString("base64"), mime: "image/jpeg" as const });

/** A fake Sarvam: counts jobs, answers every job with `result`, records the uploaded file and schema keys. */
function fakeSarvam(result: unknown, opts: { failStart?: boolean } = {}) {
  const jobs: { file: string; type: string; props: string[] }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/extract")) {
      if (opts.failStart) return res({ error: "down" }, 503);
      const form = init!.body as FormData;
      const f = form.get("file") as File;
      const schema = JSON.parse(String(form.get("schema")));
      jobs.push({ file: f.name, type: f.type, props: Object.keys(schema.properties) });
      return res({ job_id: `j${jobs.length}` }, 201);
    }
    if (u.endsWith("/status")) return res({ status: "completed" });
    return res({ result });
  });
  return { jobs, fetchImpl: fetchImpl as unknown as typeof fetch };
}

describe("isoDateTimeIST", () => {
  it("reads payment-app timestamps", () => {
    expect(isoDateTimeIST("20 Nov 2026, 3:45 PM")).toBe("2026-11-20T15:45:00+05:30");
    expect(isoDateTimeIST("20 November 2026 at 12:05 am")).toBe("2026-11-20T00:05:00+05:30");
    expect(isoDateTimeIST("20/11/2026 15:45")).toBe("2026-11-20T15:45:00+05:30");
    expect(isoDateTimeIST("2026-11-20T15:45:00+05:30")).toBe("2026-11-20T15:45:00+05:30");
  });
  it("gives null rather than a guess", () => {
    expect(isoDateTimeIST("today")).toBeNull();
    expect(isoDateTimeIST("20 Nov 2026")).toBeNull();
    expect(isoDateTimeIST("20 Nov 2026, 25:99")).toBeNull();
    expect(isoDateTimeIST(null)).toBeNull();
  });
});

describe("shotFromSarvam / imageReadFromSarvam", () => {
  it("maps a payment screenshot", () => {
    expect(shotFromSarvam(SHOT)).toEqual({ amount: 1250, utr: "412345678901", datetime: "2026-11-20T15:45:00+05:30", payee_name: "Gupta General Store", app: "PhonePe" });
    expect(imageReadFromSarvam(SHOT).kind).toBe("payment_screenshot");
  });
  it("a bill is a bill", () => {
    const r = imageReadFromSarvam(BILL_DOC);
    expect(r.kind).toBe("supplier_bill");
    expect(r.bill?.items).toHaveLength(2);
  });
  it("does not trust a label with nothing behind it", () => {
    expect(imageReadFromSarvam({ document_type: "supplier_bill" }).kind).toBe("other");
    expect(imageReadFromSarvam({ document_type: "payment_screenshot", pay_app: "Paytm" }).kind).toBe("other");
    expect(imageReadFromSarvam({ document_type: "weird" }).kind).toBe("other");
    expect(imageReadFromSarvam(null).kind).toBe("other");
  });
});

describe("readImageSarvam (one scan per photo)", () => {
  beforeEach(() => {
    process.env.SARVAM_API_KEY = "test-key";
    _clearReadCache();
  });
  afterEach(() => {
    delete process.env.SARVAM_API_KEY;
    _clearReadCache();
  });

  it("classify + bill read cost ONE Sarvam job", async () => {
    const s = fakeSarvam(BILL_DOC);
    const i = img("bill-photo");
    const kind = (await readImageSarvam(i, { pollMs: 0, fetchImpl: s.fetchImpl })).kind;
    const bill = await extractBillSarvam(i, { pollMs: 0, fetchImpl: s.fetchImpl });
    expect(kind).toBe("supplier_bill");
    expect(bill?.total).toBe(11960);
    expect(s.jobs).toHaveLength(1);
    expect(s.jobs[0].props).toContain("document_type");
  });

  it("a bill-only scan (web upload) uses the plain bill schema", async () => {
    const s = fakeSarvam(BILL);
    await extractBillSarvam(img("other-photo"), { pollMs: 0, fetchImpl: s.fetchImpl });
    expect(s.jobs[0].props).not.toContain("document_type");
    expect(s.jobs[0].props).toContain("items");
  });

  it("does not remember a failed read", async () => {
    const i = img("flaky");
    await expect(readImageSarvam(i, { pollMs: 0, fetchImpl: fakeSarvam(null, { failStart: true }).fetchImpl })).rejects.toThrow(/503/);
    const ok = fakeSarvam(SHOT);
    expect((await readImageSarvam(i, { pollMs: 0, fetchImpl: ok.fetchImpl })).kind).toBe("payment_screenshot");
    expect(ok.jobs).toHaveLength(1);
  });

  it("converts WebP to PNG before upload (Sarvam takes JPG/PNG only)", async () => {
    const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#ffffff" } }).webp().toBuffer();
    const s = fakeSarvam(BILL_DOC);
    await readImageSarvam({ base64: webp.toString("base64"), mime: "image/webp" }, { pollMs: 0, fetchImpl: s.fetchImpl });
    expect(s.jobs[0]).toMatchObject({ file: "photo.png", type: "image/png" });
  });

  it("an undecodable WebP is a clean error, not a crash", async () => {
    const s = fakeSarvam(BILL_DOC);
    await expect(readImageSarvam({ base64: Buffer.from("not an image").toString("base64"), mime: "image/webp" }, { pollMs: 0, fetchImpl: s.fetchImpl })).rejects.toThrow(/Cannot read/);
    expect(s.jobs).toHaveLength(0);
  });
});

describe("vision.ts picks Sarvam and never needs Claude", () => {
  const keep = { ...process.env };
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    process.env = { ...keep, SARVAM_API_KEY: "test-key" };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.BILL_OCR;
    _clearReadCache();
  });
  afterEach(() => {
    process.env = { ...keep };
    globalThis.fetch = realFetch;
    _clearReadCache();
  });

  it("classify + payment shot work with NO Anthropic key (the production case), one job", async () => {
    const s = fakeSarvam(SHOT);
    globalThis.fetch = s.fetchImpl;
    const i = img("shot-1");
    expect(await classifyImage(i)).toBe("payment_screenshot");
    expect((await extractPaymentShot(i))?.amount).toBe(1250);
    expect(s.jobs).toHaveLength(1);
  }, 15_000);

  it("a Sarvam outage with no Claude key surfaces the Sarvam error", async () => {
    globalThis.fetch = fakeSarvam(null, { failStart: true }).fetchImpl;
    await expect(extractBill(img("down"))).rejects.toThrow(/503/);
    await expect(classifyImage(img("down2"))).rejects.toThrow(/503/);
  });

  it("BILL_OCR=sarvam never falls back to Claude, even with a Claude key", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-dead";
    process.env.BILL_OCR = "sarvam";
    globalThis.fetch = fakeSarvam(null, { failStart: true }).fetchImpl;
    await expect(extractBill(img("forced"))).rejects.toThrow(/503/);
  });

  it("BILL_OCR=claude skips Sarvam completely", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    process.env.BILL_OCR = "claude";
    const s = fakeSarvam(BILL);
    globalThis.fetch = s.fetchImpl;
    const claude = { messages: { parse: vi.fn(async () => ({ stop_reason: "end_turn", parsed_output: { vendor_name: "C", invoice_no: null, invoice_date: null, items: [], total: null } })) } };
    expect((await extractBill(img("claude-only"), claude as never))?.vendor_name).toBe("C");
    expect(s.jobs).toHaveLength(0);
  });
});
