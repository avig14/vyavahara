import Link from "next/link";
import { buttonClass, Table } from "@/components/ui";
import { RozmelExample } from "@/components/landing/rozmel-example";
import { SiteFooter, SiteNav } from "@/components/landing/site-chrome";

const AFTER = [
  { when: "A UPI payment arrives", then: "A new line in the rozmel, with the running total.", where: "Rozmel", hi: "रोज़मेल" },
  { when: "Udhaar runs late", then: "Khata flags it and Saathi drafts the reminder.", where: "Khata", hi: "खाता" },
  { when: "Atta runs low", then: "Stock warns you and drafts the supplier order.", where: "Stock", hi: "स्टॉक" },
  { when: "You have a question", then: "Ask Saathi in Hinglish: \"aaj ka hisaab\".", where: "Saathi", hi: null },
] as const;

export default function Home() {
  return (
    <div className="lp">
      <SiteNav />
      <main className="lp-main container">
        <section className="lp-hero" aria-labelledby="lp-title">
          <div className="lp-text">
            <h1 id="lp-title" className="lp-h1">
              Every soundbox payment lands in your rozmel.
            </h1>
            <p className="lp-lead">Khata, udhaar, stock and suppliers follow from it.</p>
            <div className="lp-actions">
              <Link href="/onboarding" className={buttonClass({ variant: "primary" })}>
                Dukaan shuru karein
              </Link>
              <Link href="/dashboard" className={buttonClass({ variant: "secondary" })}>
                See the demo dashboard
              </Link>
            </div>
          </div>
          <RozmelExample />
        </section>

        <section className="lp-after" aria-labelledby="lp-after-title">
          <h2 id="lp-after-title" className="lp-h2">
            What happens after a payment
          </h2>
          <Table caption="What Vyavahāra does for each thing that happens in the shop">
            <thead>
              <tr>
                <th scope="col">When this happens</th>
                <th scope="col">Vyavahāra does this</th>
                <th scope="col">Where</th>
              </tr>
            </thead>
            <tbody>
              {AFTER.map((r) => (
                <tr key={r.where}>
                  <td data-label="When this happens" data-primary="">
                    {r.when}
                  </td>
                  <td data-label="Vyavahāra does this">{r.then}</td>
                  <td data-label="Where">
                    <span>{r.where}</span>
                    {r.hi ? <span className="deva where-hi"> {r.hi}</span> : null}
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
