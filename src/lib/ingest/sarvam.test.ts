import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paymentAnnouncement, speak, transcribe, SarvamError } from "./sarvam";

const realFetch = globalThis.fetch;
beforeEach(() => {
  process.env.SARVAM_API_KEY = "test-key";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("sarvam", () => {
  it("STT sends multipart with key, model, codemix and parses transcript", async () => {
    const spy = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const f = init!.body as FormData;
      expect(f.get("model")).toBe("saaras:v4");
      expect(f.get("mode")).toBe("codemix");
      expect((init!.headers as Record<string, string>)["api-subscription-key"]).toBe("test-key");
      return new Response(JSON.stringify({ transcript: " do Maggi aur ek Parle-G ", language_code: "hi-IN" }), { status: 200 });
    });
    globalThis.fetch = spy as unknown as typeof fetch;
    const t = await transcribe(new Uint8Array([1, 2, 3]));
    expect(t).toEqual({ text: "do Maggi aur ek Parle-G", languageCode: "hi-IN" });
    expect(spy.mock.calls[0][0]).toBe("https://api.sarvam.ai/speech-to-text");
  });

  it("TTS uses language_code + bulbul:v3 and caches by text", async () => {
    const spy = vi.fn(async (_u: unknown, init?: RequestInit) => {
      const b = JSON.parse(init!.body as string);
      expect(b).toMatchObject({ language_code: "hi-IN", model: "bulbul:v3", speaker: "shubh" });
      return new Response(JSON.stringify({ audios: [Buffer.from("RIFFfake").toString("base64")] }), { status: 200 });
    });
    globalThis.fetch = spy as unknown as typeof fetch;
    const a = await speak("1,250 rupaye mile");
    const b = await speak("1,250 rupaye mile");
    expect(a.toString()).toBe("RIFFfake");
    expect(b).toBe(a);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("surfaces API errors and a missing key", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 })) as unknown as typeof fetch;
    await expect(speak("kuch alag text")).rejects.toMatchObject({ status: 429 });
    delete process.env.SARVAM_API_KEY;
    await expect(transcribe(new Uint8Array([1]))).rejects.toBeInstanceOf(SarvamError);
  });

  it("announcement text", () => {
    expect(paymentAnnouncement(125_000)).toBe("1,250 rupaye mile");
    expect(paymentAnnouncement(2850)).toBe("28 rupaye 50 paise mile");
  });
});
