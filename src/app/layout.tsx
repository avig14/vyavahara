import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import Script from "next/script";
import { STRIP_EXTENSION_ATTRS } from "@/components/dev/strip-extension-attrs";
import { LangProvider } from "@/lib/ui/lang";
import { LANG_COOKIE, parseLang } from "@/lib/ui/i18n";
import "./globals.css";

/** The very Inter file paytm.com serves (variable, weights 100 to 900, Latin). Inter is open source (SIL OFL). Glyphs it lacks, such as ₹, fall through to the Google Inter below. */
const interPaytm = localFont({
  src: "./fonts/Inter-paytm.woff2",
  weight: "100 900",
  variable: "--font-inter-paytm",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-deva",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Vyavahāra (व्यवहार)", template: "%s · Vyavahāra" },
  description:
    "Stock, khata, payables and reports for a kirana shop, from one place. Built for the Paytm Merchant Growth AI hackathon.",

  openGraph: {
    title: "Vyavahāra (व्यवहार)",
    description:
      "Every soundbox payment lands in your rozmel. Khata, udhaar, stock and suppliers follow from it.",
    images: [
      {
        url: "/brand/vyavahara-og-soundbox-ledger-v1.png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/brand/vyavahara-og-soundbox-ledger-v1.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#002970",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return (
    <html
      lang={lang === "hi" ? "hi" : lang === "hing" ? "en-IN" : "en"}
      className={`${interPaytm.variable} ${inter.variable} ${deva.variable}`}
    >
      <body>
        {process.env.NODE_ENV !== "production" ? <Script id="strip-extension-attrs" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS }} /> : null}
        <LangProvider initial={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
