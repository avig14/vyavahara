import { Suspense } from "react";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { SiteFooter, SiteNav } from "@/components/landing/site-chrome";
import { OnboardingHead } from "@/components/onboarding/onboarding-head";
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
        <OnboardingHead />
        <Suspense fallback={<SkeletonBlock height="16rem" />}>
          <OnboardingFlow />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
