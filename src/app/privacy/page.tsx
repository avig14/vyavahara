import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "@/components/landing/site-chrome";
import { PrivacyBody } from "@/components/landing/privacy-body";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What this build stores, where it goes and why, taken from what the code does.",
};

export default function PrivacyPage() {
  return (
    <div className="lp">
      <SiteNav />
      <main className="lp-main container pv">
        <PrivacyBody />
      </main>
      <SiteFooter />
    </div>
  );
}
