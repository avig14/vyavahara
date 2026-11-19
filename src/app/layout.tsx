import type { Metadata, Viewport } from "next";
import { Figtree, Noto_Sans_Devanagari } from "next/font/google";
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
      <body>{children}</body>
    </html>
  );
}
