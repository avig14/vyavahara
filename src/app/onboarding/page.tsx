import { Suspense } from "react";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { SiteFooter, SiteNav } from "@/components/landing/site-chrome";
import { SkeletonBlock } from "@/components/ui";

export const metadata: Metadata = {
  title: "Set up your shop",
  description: "Four steps: shop, Paytm, WhatsApp, done.",
};

export default function OnboardingPage() {
  return (
    <div className="lp">
      <SiteNav />
      <main className="lp-main container ob">
        <header className="ob-head">
          <h1 className="ob-h1">Set up your shop</h1>
          <p className="lead">Check the shop, connect Paytm, then open the dashboard.</p>
        </header>
        <Suspense fallback={<SkeletonBlock height="16rem" />}>
          <OnboardingFlow />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
