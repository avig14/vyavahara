/** What Call Saathi says. Wording is fixed; the numbers come from code (the AI never calculates). */
import { gather, hangup, speak, xml } from "./vobiz";

export interface CallFacts {
  customerName: string;
  shopName: string;
  amountPaise: number;
  overdueDays: number;
}

/** TTS reads "₹1,200" badly, so say "1200 rupaye". */
export const spokenAmount = (paise: number) => `${Math.round(paise / 100)} rupaye`;

export function openingPrompt(f: CallFacts): string {
  return (
    `Namaste ${f.customerName}. Main ${f.shopName} ki taraf se Saathi bol raha hoon, ek automatic reminder call. ` +
    `Aapka ${spokenAmount(f.amountPaise)} ka udhaar ${f.overdueDays} din se baaki hai. ` +
    `Agar aap jald dene wale hain, to 1 dabayein. Dukaan se baat karni ho, to 2 dabayein. Call khatam karne ke liye 3 dabayein.`
  );
}

export function answerXml(f: CallFacts, gatherUrl: string, language?: string): string {
  return xml(gather(gatherUrl, openingPrompt(f), language) + speak("Koi jawab nahi mila. Dhanyavaad.", language) + hangup());
}

export type Outcome = "will_pay" | "call_back" | "no_response";

export function outcomeFor(digit: string | null | undefined): Outcome {
  return digit === "1" ? "will_pay" : digit === "2" ? "call_back" : "no_response";
}

export function replyXml(outcome: Outcome, f: CallFacts, language?: string): string {
  const line =
    outcome === "will_pay"
      ? `Shukriya ${f.customerName}. Hum aapke ${spokenAmount(f.amountPaise)} ka intezaar karenge. Aap UPI se bhi de sakte hain.`
      : outcome === "call_back"
        ? `Theek hai. Maine ${f.shopName} ko bata diya hai, woh aapko khud call karenge. Dhanyavaad.`
        : "Dhanyavaad. Namaste.";
  return xml(speak(line, language) + hangup());
}
