import type { Metadata } from "next";

/** The pay link is a secret: keep it out of search results and out of Referer headers. */
export const metadata: Metadata = {
  title: "Khata payment",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PayLayout({ children }: LayoutProps<"/pay/[token]">) {
  return children;
}
