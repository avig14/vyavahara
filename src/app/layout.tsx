import type { Metadata, Viewport } from "next";
import { Figtree, Noto_Sans_Devanagari } from "next/font/google";
import Script from "next/script";
import { STRIP_EXTENSION_ATTRS } from "@/components/dev/strip-extension-attrs";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
  display: "swap",
});

const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-deva",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Vyavahāra (व्यवहार)", template: "%s · Vyavahāra" },
  description: "Stock, khata, payables and reports for a kirana shop, from one place. Built for the Paytm Merchant Growth AI hackathon.",
};

export const viewport: Viewport = {
  themeColor: "#002970",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${deva.variable}`}>
      <body>
        {process.env.NODE_ENV !== "production" ? <Script id="strip-extension-attrs" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS }} /> : null}
        {children}
      </body>
    </html>
  );
}
