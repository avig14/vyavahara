"use client";

import Link from "next/link";
import { buttonClass, Table } from "@/components/ui";
import { RozmelExample } from "@/components/landing/rozmel-example";
import { SiteFooter, SiteNav } from "@/components/landing/site-chrome";
import { T, useL, useT } from "@/lib/ui/lang";

const AFTER = [
  { id: "r1", where: "rozmel", hi: "रोज़मेल" },
  { id: "r2", where: "khata", hi: "खाता" },
  { id: "r3", where: "stock", hi: "स्टॉक" },
  { id: "r4", where: "saathi", hi: null },
] as const;

export default function Home() {
  const t = useT();
  const l = useL();
  return (
    <div className="lp">
      <SiteNav />
      <main className="lp-main">
        <div className="lp-hero-wrap">
          <section className="lp-hero container" aria-labelledby="lp-title">
            <div className="lp-text">
              <h1 id="lp-title" className="lp-h1">
                <T k="hero.h1" />
              </h1>
              <p className="lp-lead">
                <T k="hero.lead" />
              </p>
              <div className="lp-actions">
                <Link
                  href="/onboarding"
                  className={buttonClass({ variant: "primary" })}
                >
                  <T k="hero.cta1" />
                </Link>
                <Link
                  href="/dashboard"
                  className={buttonClass({ variant: "secondary" })}
                >
                  <T k="hero.cta2" />
                </Link>
              </div>
            </div>
            <picture className="lp-art">
              <source
                media="(max-width: 48rem)"
                srcSet="/brand/vyavahara-hero-mobile-soundbox-ledger-v1.svg"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/vyavahara-hero-soundbox-ledger-v1.svg"
                alt={l(
                  "A soundbox sends each payment as a new line into the rozmel, which feeds Khata, Stock and Saathi.",
                  "साउंडबॉक्स हर पेमेंट को रोज़मेल की नई लाइन में भेजता है, जिससे खाता, स्टॉक और साथी चलते हैं।",
                  "Soundbox har payment ko rozmel ki nayi line mein bhejta hai, jisse Khata, Stock aur Saathi chalte hain.",
                )}
                width={1200}
                height={760}
                fetchPriority="high"
              />
            </picture>
          </section>
        </div>

        <section
          className="lp-example"
          aria-label={l("Example rozmel", "उदाहरण रोज़मेल", "Example rozmel")}
        >
          <div className="container">
            <RozmelExample />
          </div>
        </section>

        <img
          className="lp-rule"
          src="/brand/vyavahara-divider-ledger-rule-v1.svg"
          alt=""
          aria-hidden="true"
          width={1440}
          height={24}
        />

        <section
          className="lp-after container"
          aria-labelledby="lp-after-title"
        >
          <h2 id="lp-after-title" className="lp-h2">
            <T k="after.h2" />
          </h2>
          <div className="lp-flow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/vyavahara-diagram-payment-flow-v1.svg"
              alt={l(
                "A payment reaches the soundbox, becomes a line in the rozmel, then feeds Khata, Stock and Saathi.",
                "पेमेंट साउंडबॉक्स तक आता है, रोज़मेल की लाइन बनता है, फिर खाता, स्टॉक और साथी को चलाता है।",
                "Payment soundbox tak aata hai, rozmel ki line banta hai, phir Khata, Stock aur Saathi ko chalata hai.",
              )}
              width={1200}
              height={320}
              loading="lazy"
            />
          </div>
          <Table caption={t("after.caption")}>
            <thead>
              <tr>
                <th scope="col">{t("after.when")}</th>
                <th scope="col">{t("after.does")}</th>
                <th scope="col">{t("after.where")}</th>
              </tr>
            </thead>
            <tbody>
              {AFTER.map((r) => (
                <tr key={r.where}>
                  <td data-label={t("after.when")} data-primary="">
                    {t(`after.${r.id}.when`)}
                  </td>
                  <td data-label={t("after.does")}>
                    {t(`after.${r.id}.then`)}
                  </td>
                  <td data-label={t("after.where")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="where-icon"
                      src={`/brand/vyavahara-icon-${r.where}-v1.svg`}
                      alt=""
                      width={40}
                      height={40}
                    />
                    <span>{t(`where.${r.where}`)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
