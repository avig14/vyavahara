import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "@/components/landing/site-chrome";
import { Table } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this build stores, where it goes and why, taken from what the code does.",
};

/** Every row is something the code does: see src/lib/db/schema.ts, src/lib/hash.ts, src/lib/ingest, src/lib/agent. */
const ROWS = [
  { kind: "Shop profile", where: "Neon database", why: "Shows your shop" },
  { kind: "Payments, customers, udhaar", where: "Neon database", why: "Rozmel, khata, reports" },
  { kind: "Payer UPI ids", where: "Neon, as a one-way hash", why: "Spot repeat payers" },
  { kind: "Stock, suppliers, bills", where: "Neon database", why: "Alerts and orders" },
  { kind: "Soundbox text", where: "Neon and Anthropic", why: "Match a basket" },
  { kind: "Voice clips, announcements", where: "Sarvam; clips not kept by us", why: "Speech and text" },
  { kind: "Saathi chat", where: "Neon and Anthropic", why: "Answer questions" },
  { kind: "Pay links, audit log", where: "Neon database", why: "Sharing, change record" },
] as const;

export default function PrivacyPage() {
  return (
    <div className="lp">
      <SiteNav />
      <main className="lp-main container pv">
        <section className="pv-first" aria-labelledby="pv-title">
          <h1 id="pv-title" className="pv-h1">What we store and who sees it</h1>
          <p className="lead">Written from what this build&apos;s code does.</p>
          <Table caption="Kinds of data, where each goes, and why">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Where it goes</th>
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.kind}>
                  <td data-label="Data" data-primary="">
                    {r.kind}
                  </td>
                  <td data-label="Where it goes">{r.where}</td>
                  <td data-label="Why">{r.why}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>

        <section className="pv-sec" aria-labelledby="pv-svc">
          <h2 id="pv-svc">Two outside services see part of this data.</h2>
          <div className="pv-body">
            <p>Sarvam handles speech. Claude from Anthropic reads soundbox text and answers Saathi. Each service sets its own retention.</p>
          </div>
        </section>

        <section className="pv-sec" aria-labelledby="pv-long">
          <h2 id="pv-long">Nothing here deletes data on a schedule.</h2>
          <div className="pv-body">
            <p>Rows stay in Neon until removed. Pay and report links stop working after 7 days.</p>
          </div>
        </section>

        <section className="pv-sec" aria-labelledby="pv-not">
          <h2 id="pv-not">We do not collect plain UPI ids or audio.</h2>
          <div className="pv-body">
            <p>Also not collected: photos, bills, passwords and ad trackers. Your browser keeps only the shop and owner name until the tab closes.</p>
          </div>
        </section>

        <section className="pv-sec" aria-labelledby="pv-demo">
          <h2 id="pv-demo">This demo has no sign-in, so the sample shop is open.</h2>
          <div className="pv-body">
            <p>Anyone who opens this app sees it. The soundbox keeps text only for clips about shop business. Personal talk is dropped at once and never saved.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
