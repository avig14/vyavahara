"use client";

import Link from "next/link";
import { BrandIcon, type BrandIconName } from "@/components/ui/brand-icon";
import { useL } from "@/lib/ui/lang";

/** Paytm-style icon row: where to go next. Every tile is a real page of this app. */
export function Shortcuts() {
  const l = useL();
  const tiles: { href: string; icon: BrandIconName; label: string }[] = [
    {
      href: "/dashboard/inventory",
      icon: "stock",
      label: l("Stock", "स्टॉक", "Stock"),
    },
    {
      href: "/dashboard/vendors",
      icon: "supplier",
      label: l("Suppliers", "सप्लायर", "Suppliers"),
    },
    {
      href: "/dashboard/khata",
      icon: "khata",
      label: l("Khata", "खाता", "Khata"),
    },
    {
      href: "/dashboard/customers",
      icon: "customers",
      label: l("Customers", "ग्राहक", "Customers"),
    },
    {
      href: "/dashboard/reports",
      icon: "reports",
      label: l("Reports", "रिपोर्ट", "Reports"),
    },
    {
      href: "/dashboard/growth",
      icon: "growth",
      label: l("Growth", "ग्रोथ", "Growth"),
    },
  ];
  return (
    <section className="sc-card" aria-labelledby="sc-h">
      <h2 id="sc-h" className="sc-h">
        {l("Run your shop", "अपनी दुकान चलाएँ", "Apni dukaan chalao")}
      </h2>
      <ul className="sc-grid">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="sc-tile">
              <BrandIcon name={t.icon} size={64} className="sc-ic" />
              <span className="sc-label">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Three pastel banners in the Paytm style: a heading, one line, one pill button. */
export function Banners() {
  const l = useL();
  const items: {
    tone: string;
    icon: BrandIconName;
    title: string;
    text: string;
    cta: string;
    href?: string;
  }[] = [
    {
      tone: "blue",
      icon: "stock",
      href: "/dashboard/inventory",
      title: l(
        "Running low on something?",
        "कुछ कम पड़ रहा है?",
        "Kuch kam pad raha hai?",
      ),
      text: l(
        "See what will run out first and how much to order.",
        "देखें क्या पहले ख़त्म होगा और कितना मँगवाना है।",
        "Dekho kya pehle khatam hoga aur kitna mangwana hai.",
      ),
      cta: l("Open Stock", "स्टॉक खोलें", "Stock kholo"),
    },
    {
      tone: "cream",
      icon: "khata",
      href: "/dashboard/khata",
      title: l(
        "Someone paid you back?",
        "किसी ने पैसे लौटाए?",
        "Kisi ne paise lautaye?",
      ),
      text: l(
        "Record the payment in a few seconds.",
        "कुछ सेकंड में पेमेंट लिख लें।",
        "Kuch second mein payment likh lo.",
      ),
      cta: l("Open Khata", "खाता खोलें", "Khata kholo"),
    },
    {
      tone: "lilac",
      icon: "saathi",
      title: l(
        "Ask Saathi anything",
        "साथी से कुछ भी पूछें",
        "Saathi se kuch bhi poochho",
      ),
      text: l(
        "Sales, stock, khata. Ask in your own words.",
        "बिक्री, स्टॉक, खाता। अपने शब्दों में पूछें।",
        "Bikri, stock, khata. Apne shabdon mein poochho.",
      ),
      cta: l("Ask Saathi", "साथी से पूछें", "Saathi se poochho"),
    },
  ];
  return (
    <div className="bn-row">
      {items.map((b) => (
        <article key={b.title} className="bn" data-tone={b.tone}>
          <div className="bn-text">
            <h3 className="bn-h">{b.title}</h3>
            <p className="bn-p">{b.text}</p>
            {b.href ? (
              <Link href={b.href} className="bn-btn">
                {b.cta} <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <button
                type="button"
                className="bn-btn"
                onClick={() =>
                  window.dispatchEvent(new Event("vy:open-saathi"))
                }
              >
                {b.cta} <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          <BrandIcon name={b.icon} size={112} className="bn-ic" />
        </article>
      ))}
    </div>
  );
}
