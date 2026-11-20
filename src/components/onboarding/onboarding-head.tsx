"use client";

import { useL } from "@/lib/ui/lang";

export function OnboardingHead() {
  const l = useL();
  return (
    <header className="ob-head">
      <h1 className="ob-h1">
        {l("Set up your shop", "अपनी दुकान शुरू करें", "Apni dukaan shuru karo")}
      </h1>
      <p className="lead">
        {l(
          "Check the shop, connect Paytm, then open the dashboard.",
          "दुकान देखें, Paytm जोड़ें, फिर डैशबोर्ड खोलें।",
          "Dukaan dekho, Paytm jodo, phir dashboard kholo.",
        )}
      </p>
    </header>
  );
}
