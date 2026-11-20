import { describe, expect, it } from "vitest";
import { normalise, parseVoiceChoice, replyLanguage, spokenGreeting, spokenRupees, toSpoken, voiceIntent, type Insight } from "./voice";
import { signSpoken, verifySpoken } from "./sign";
import { hit, resetRateLimits } from "../server/rate-limit";

describe("parseVoiceChoice", () => {
  it.each([
    ["Haan", 1],
    ["haan ji.", 1],
    ["Haan kar do bhai", 1],
    ["हाँ", 1],
    ["जी हां।", 1],
    ["theek hai", 1],
    ["ok", 1],
    ["Nahi", 2],
    ["nahin rehne do", 2],
    ["नहीं।", 2],
    ["na", 2],
    ["cancel", 2],
  ] as const)("%s → %s", (t, want) => expect(parseVoiceChoice(t)).toBe(want));

  it.each(["", "Maggi ke 20 packet aaye", "nahi pata maggi kitne din mein khatam hoga bhai", "kal ki sale", "namaste"])("%s → null", (t) =>
    expect(parseVoiceChoice(t)).toBeNull(),
  );
});

describe("voiceIntent", () => {
  it.each([
    ["Namaste", "menu"],
    ["hello", "menu"],
    ["Tum kya kar sakte ho?", "menu"],
    ["Aaj ki sale kitni hui?", "report"],
    ["aaj ka hisaab batao", "report"],
    ["आज की बिक्री कितनी हुई?", "report"],
    ["Kya khatam hone wala hai?", "stock"],
    ["kaunsa maal khatam hone wala hai", "stock"],
    ["Kitne logon ka udhaar baaki hai?", "khata"],
    ["kiske kiske udhaar baaki hai", "khata"],
    ["supplier ko kitna dena hai", "suppliers"],
    ["kisko kitna dena hai", "suppliers"],
    // Sarvam often returns Hinglish speech in Devanagari
    ["आज की सेल कितनी हुई?", "report"],
    ["क्या खत्म होने वाला है?", "stock"],
    ["कितने लोगों का उधार बाकी है?", "khata"],
    ["सप्लायर को कितना देना है?", "suppliers"],
    ["कल की सेल कितनी थी?", "agent"],
    ["मैगी कब खत्म होगी?", "agent"],
    // specific or time-bound → agent
    ["Kal ki sales kitni thi?", "agent"],
    ["is hafte ka profit", "agent"],
    ["Maggi kab khatam hoga?", "agent"],
    ["Maggi ke 20 packet aaye hain", "agent"],
    ["Suresh ka udhaar kitna hai", "agent"],
    ["Suresh ko 300 udhaar diya", "agent"],
  ] as const)("%s → %s", (t, want) => expect(voiceIntent(t)).toBe(want));
});

describe("toSpoken", () => {
  it("strips WhatsApp formatting, emoji and menu hint; says rupees and percent", () => {
    const s = toSpoken("📊 *Aaj ka report*\n💰 Sales *₹18,450* (42 bills)\n📉 Pichle Thursday se *−8%*\nMenu ke liye 'Hi' likhein");
    expect(s).not.toMatch(/[*📊💰📉]/u);
    expect(s).toContain("18,450 rupaye");
    expect(s).toContain("8 percent");
    expect(s).not.toMatch(/menu ke liye/i);
  });

  it("turns bullets and lines into sentences and drops links", () => {
    const s = toSpoken("Jaldi khatam:\n• Maggi ~2 din\n• Sugar ~3 din\nPDF: https://x.y/r/abc");
    expect(s).not.toContain("•");
    expect(s).not.toContain("https");
    expect(s).toContain("Maggi");
  });

  it("cuts long text at a sentence end", () => {
    const s = toSpoken("Pehla vakya hai. ".repeat(40), 100);
    expect(s.length).toBeLessThanOrEqual(100);
    expect(s.endsWith(".")).toBe(true);
  });
});

describe("helpers", () => {
  it("spokenRupees uses Indian commas and rounds to the rupee", () => {
    expect(spokenRupees(12_345_678_90)).toBe("1,23,45,679 rupaye");
    expect(spokenRupees(2800)).toBe("28 rupaye");
  });
  it("normalise drops danda and punctuation", () => expect(normalise("  हाँ।  Kar do! ")).toBe("हाँ kar do"));
  it("replyLanguage is English only when STT said en-IN", () => {
    expect(replyLanguage("en-IN")).toBe("en-IN");
    expect(replyLanguage("hi-IN")).toBe("hi-IN");
    expect(replyLanguage(null)).toBe("hi-IN");
  });
});

describe("sign", () => {
  it("verifies only the exact text and language", () => {
    const sig = signSpoken("Aaj 100 rupaye", "hi-IN", "k");
    expect(verifySpoken("Aaj 100 rupaye", "hi-IN", sig, "k")).toBe(true);
    expect(verifySpoken("Aaj 900 rupaye", "hi-IN", sig, "k")).toBe(false);
    expect(verifySpoken("Aaj 100 rupaye", "en-IN", sig, "k")).toBe(false);
    expect(verifySpoken("Aaj 100 rupaye", "hi-IN", "bad", "k")).toBe(false);
  });
});

describe("rate limit", () => {
  it("allows max per window, then blocks until the window ends", () => {
    resetRateLimits();
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(hit("a", 3, 1000, t).ok).toBe(true);
    const blocked = hit("a", 3, 1000, t + 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(hit("a", 3, 1000, t + 1000).ok).toBe(true);
  });
});

describe("spokenGreeting", () => {
  const ins = (id: string, tone: Insight["tone"], spoken: string): Insight => ({ id, tone, label: id, title: id, spoken, ask: id });
  const all = [ins("sales", "good", "aaj ab tak 5,000 rupaye ki sale hui hai"), ins("k1", "risk", "Suresh pe 2,400 rupaye ka udhaar 53 din se baaki hai"), ins("s1", "stock", "Maggi 2 din mein khatam ho jayega"), ins("p1", "money", "Sharma Traders ko 12,400 rupaye dene hain, kal due"), ins("r", "info", "Amul Taaza stock karo")];

  it("says namaste, today's sales, and exactly two important insights", () => {
    const g = spokenGreeting(all, () => 0.5);
    expect(g.text.startsWith("Namaste!")).toBe(true);
    expect(g.text).toContain("5,000 rupaye");
    expect(g.picked).toHaveLength(2);
    expect(g.picked.every((id) => ["k1", "s1", "p1"].includes(id))).toBe(true);
    expect(g.text.endsWith("Boliye, kya jaanna hai?")).toBe(true);
  });

  it("picks different insights for different random draws", () => {
    let n = 0;
    const seqA = [0.1, 0.2, 0.9];
    const seqB = [0.9, 0.2, 0.1];
    const a = spokenGreeting(all, () => seqA[n++ % 3]!).picked;
    n = 0;
    const b = spokenGreeting(all, () => seqB[n++ % 3]!).picked;
    expect(a).not.toEqual(b);
  });

  it("still greets when there is nothing urgent", () => {
    const g = spokenGreeting([all[0]!], () => 0.5);
    expect(g.picked).toHaveLength(0);
    expect(g.text).toContain("Namaste!");
  });
});
