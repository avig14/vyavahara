/**
 * Photos that go with a reply, like the Delhi Metro bot sends a banner or a ticket image with its text.
 * Welcome banner: assets/social. Cards: drawn from live data by /api/wa/card/[kind] (layouts after assets/social).
 * The same list can later be sent through the Cloud API as image messages (link + caption).
 */
import type { Intent } from "./router";
import { cardUrlFor } from "./cards-data";

export interface WaImage {
  /** path on this app; prefix APP_BASE_URL to send it through the Cloud API */
  src: string;
  alt: string;
  /** short line under the photo, like a WhatsApp image caption */
  caption?: string;
}

export function imagesFor(intent: Intent, version: number | string = Date.now()): WaImage[] {
  switch (intent) {
    case "menu":
      return [{ src: "/wa/welcome.png", alt: "Vyavahāra: Namaste, main Saathi hoon", caption: "Aapki dukaan ka hisaab, Hinglish mein 🙏" }];
    case "report":
      return [{ src: cardUrlFor("daily", version), alt: "Hisaab: total, UPI aur cash", caption: "📊 Hisaab" }];
    case "khata":
      return [{ src: cardUrlFor("udhaar", version), alt: "Udhaar reminder ka draft", caption: "📒 Udhaar reminder" }];
    case "stock":
      return [{ src: cardUrlFor("stock", version), alt: "Stock alert aur supplier order ka draft", caption: "📦 Stock alert" }];
    default:
      return [];
  }
}
