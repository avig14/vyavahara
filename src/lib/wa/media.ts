/**
 * Photos that go with a reply in the dashboard chat preview. Welcome banner: public/wa. Cards: drawn from live data
 * by /api/wa/card/[kind] (layouts after assets/social). `shown` is what the preview just showed (PreviewReply.shown):
 * the main menu, today's report (4.1), the udhaar list (3.1) or the stock list (1.1).
 * The same list can later be sent through a provider as image messages (link + caption).
 */
import { cardUrlFor } from "./cards-data";

export interface WaImage {
  /** path on this app; prefix APP_BASE_URL to send it through a provider */
  src: string;
  alt: string;
  /** short line under the photo, like a WhatsApp image caption */
  caption?: string;
}

export function imagesFor(shown: string | null, version: number | string = Date.now()): WaImage[] {
  switch (shown) {
    case "menu":
      return [{ src: "/wa/welcome.png", alt: "Vyavahāra: Namaste, main Saathi hoon", caption: "Aapki dukaan ka hisaab, Hinglish mein 🙏" }];
    case "4.1":
      return [{ src: cardUrlFor("daily", version), alt: "Hisaab: total, UPI aur cash", caption: "📊 Hisaab" }];
    case "3.1":
      return [{ src: cardUrlFor("udhaar", version), alt: "Udhaar reminder ka draft", caption: "📒 Udhaar reminder" }];
    case "1.1":
      return [{ src: cardUrlFor("stock", version), alt: "Stock alert aur supplier order ka draft", caption: "📦 Stock alert" }];
    default:
      return [];
  }
}
