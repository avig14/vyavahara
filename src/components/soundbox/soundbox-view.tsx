"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Table,
} from "@/components/ui";
import { LangToggle, useL, type L } from "@/lib/ui/lang";
import { RefreshIcon } from "@/components/ui/icons";
import { num, rupees, rupeesExact } from "@/lib/format";
import {
  dayLabelWeekday,
  humanize,
  istTime,
  istTimeSeconds,
} from "@/lib/ui/ist-labels";
import {
  POLL_MS,
  useRozmel,
  type RozmelResponse,
  type RozmelRow,
} from "./use-rozmel";

const METHOD: Record<string, string> = {
  upi: "UPI",
  cash: "Cash",
  card: "Card",
};
const methodLabel = (m: string) => METHOD[m] ?? humanize(m);

function itemsLine(row: RozmelRow, l: L): string {
  if (row.items.length === 0) return "";
  const names = row.items
    .slice(0, 3)
    .map((i) => (i.qty > 1 ? `${i.name} x${num(i.qty)}` : i.name));
  const more = row.items.length - names.length;
  return more > 0
    ? `${names.join(", ")} ${l("and", "और", "aur")} ${more} ${l("more", "और", "aur")}`
    : names.join(", ");
}

function Money({ paise, className }: { paise: number; className?: string }) {
  return (
    <span className={paise < 0 ? `gr-neg ${className ?? ""}` : className}>
      {rupeesExact(paise)}
    </span>
  );
}

function Hero({ data }: { data: RozmelResponse }) {
  const l = useL();
  const lastSale = [...data.rows].reverse().find((r) => r.kind === "sale");
  return (
    <section
      className="sb-hero"
      aria-label={l(
        "Last payment and today's total",
        "आख़िरी पेमेंट और आज का जोड़",
        "Aakhri payment aur aaj ka jod",
      )}
    >
      <div className="sb-last">
        <p className="sb-label">
          {l("Last payment received", "आख़िरी मिला पेमेंट", "Aakhri mila payment")}
        </p>
        {lastSale ? (
          <>
            <p className="sb-amount figure" aria-live="polite">
              {rupeesExact(lastSale.amountPaise)}
            </p>
            <p className="sb-meta">
              <span className="sb-meta-time">{istTime(lastSale.at)}</span>
              <span>{methodLabel(lastSale.method)}</span>
              {lastSale.payer ? (
                <span>
                  {l("from", "से", "se")} {lastSale.payer}
                </span>
              ) : null}
            </p>
            {itemsLine(lastSale, l) ? (
              <p className="sb-items">{itemsLine(lastSale, l)}</p>
            ) : null}
          </>
        ) : (
          <p className="sb-amount figure" aria-live="polite">
            {l("None yet", "अभी कोई नहीं", "Abhi koi nahi")}
          </p>
        )}
      </div>
      <div className="sb-total">
        <p className="sb-label">
          {l("Today so far", "आज अब तक", "Aaj ab tak")}
        </p>
        <p className="sb-total-fig figure">{rupees(data.totalPaise)}</p>
        <p className="sb-label">
          {num(data.count)}{" "}
          {data.count === 1
            ? l("entry", "एंट्री", "entry")
            : l("entries", "एंट्री", "entries")}
        </p>
      </div>
    </section>
  );
}

function Rozmel({ data }: { data: RozmelResponse }) {
  const l = useL();
  const rows = [...data.rows].reverse();
  return (
    <section
      className="sb-roz"
      aria-label={l(
        "Rozmel, today's day-book",
        "रोज़मेल, आज की रोज़ की बही",
        "Rozmel, aaj ki roz ki bahi",
      )}
    >
      <div className="sb-roz-head">
        <h2>{l("Rozmel", "रोज़मेल", "Rozmel")}</h2>
        <p className="sb-label">
          {dayLabelWeekday(data.day)},{" "}
          {l("newest first", "नया ऊपर", "naya upar")}
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon="soundbox"
          title={l(
            "No payments yet today",
            "आज अभी कोई पेमेंट नहीं",
            "Aaj abhi koi payment nahi",
          )}
          description={l(
            "Each payment appears here the moment it is recorded.",
            "हर पेमेंट दर्ज होते ही यहाँ दिखेगा।",
            "Har payment darj hote hi yahan dikhega.",
          )}
        />
      ) : (
        <Table
          restack={false}
          caption={l(
            `Receipts on ${dayLabelWeekday(data.day)}, newest first, with the running total after each line`,
            `${dayLabelWeekday(data.day)} की रसीदें, नई ऊपर, हर लाइन के बाद जोड़ के साथ`,
            `${dayLabelWeekday(data.day)} ki receipts, nayi upar, har line ke baad jod ke saath`,
          )}
        >
          <thead>
            <tr>
              <th scope="col">{l("Time", "समय", "Time")}</th>
              <th scope="col">{l("Details", "ब्योरा", "Details")}</th>
              <th scope="col" className="num">
                {l("Amount", "रक़म", "Amount")}
              </th>
              <th scope="col" className="num sb-run-col">
                {l("Running total", "जोड़", "Running total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} data-newest={i === 0 ? "" : undefined}>
                <td>{istTime(r.at)}</td>
                <td>
                  {r.payer ?? l("Walk-in", "ग्राहक (बिना नाम)", "Walk-in")}
                  {r.kind === "refund" ? (
                    <>
                      {" "}
                      <Badge tone="danger">
                        {l("Refund", "रिफंड", "Refund")}
                      </Badge>
                    </>
                  ) : null}
                  <span className="sb-sub">
                    {[methodLabel(r.method), itemsLine(r, l)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </td>
                <td className="num">
                  <span className="sb-amt">
                    <Money paise={r.amountPaise} />
                  </span>
                  <span className="sb-sub sb-run-sub">
                    {l("Total", "कुल", "Kul")} {rupeesExact(r.runningTotalPaise)}
                  </span>
                </td>
                <td className="num sb-run-col">
                  {rupeesExact(r.runningTotalPaise)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}

export function SoundboxView() {
  const l = useL();
  const { data, error, loading, fetching, updatedAt, refresh } = useRozmel();
  const seconds = POLL_MS / 1000;

  return (
    <div className="sb">
      <header className="sb-bar">
        <span className="sb-mark">
          <span className="sb-mark-latin">
            {l("Vyavahāra", "व्यवहार", "Vyavahāra")}
          </span>
        </span>
        <LangToggle />
        <Link href="/dashboard" className="sb-link">
          {l("Open dashboard", "डैशबोर्ड खोलें", "Dashboard kholo")}
        </Link>
      </header>
      <main className="sb-main">
        <h1 className="visually-hidden">
          {l("Soundbox counter", "साउंडबॉक्स काउंटर", "Soundbox counter")}
        </h1>

        {error && data ? (
          <div className="sb-warn" role="alert">
            <p>
              <strong>
                {l("Not connected.", "कनेक्ट नहीं है।", "Connect nahi hai.")}
              </strong>{" "}
              {updatedAt
                ? l(
                    `Showing what was true at ${istTimeSeconds(updatedAt)}. `,
                    `${istTimeSeconds(updatedAt)} तक की जानकारी दिख रही है। `,
                    `${istTimeSeconds(updatedAt)} tak ki jaankari dikh rahi hai. `,
                  )
                : ""}
              {l(
                `Trying again every ${seconds} seconds.`,
                `हर ${seconds} सेकंड में फिर कोशिश हो रही है।`,
                `Har ${seconds} second mein phir koshish ho rahi hai.`,
              )}
            </p>
            <Button
              variant="secondary"
              icon={<RefreshIcon size={16} />}
              loading={fetching}
              onClick={refresh}
            >
              {l("Try now", "अभी कोशिश करें", "Abhi koshish karo")}
            </Button>
          </div>
        ) : null}

        {!data && loading ? (
          <>
            <Skeleton
              shape="block"
              height="9rem"
              label={l(
                "Loading last payment",
                "आख़िरी पेमेंट लोड हो रहा है",
                "Aakhri payment load ho raha hai",
              )}
            />
            <Skeleton
              shape="rows"
              count={6}
              cols={4}
              label={l(
                "Loading rozmel",
                "रोज़मेल लोड हो रहा है",
                "Rozmel load ho raha hai",
              )}
            />
          </>
        ) : null}

        {!data && error ? (
          <ErrorState
            title={l(
              "Could not load today's payments",
              "आज के पेमेंट नहीं खुल पाए",
              "Aaj ke payments nahi khul paye",
            )}
            error={error}
            onRetry={refresh}
            retrying={fetching}
          />
        ) : null}

        {data ? (
          <>
            <Hero data={data} />
            <Rozmel data={data} />
            <p className="sb-conn">
              {error
                ? l("Not connected.", "कनेक्ट नहीं है।", "Connect nahi hai.")
                : l(
                    `Live. Updated ${updatedAt ? istTimeSeconds(updatedAt) : ""}.`,
                    `लाइव। ${updatedAt ? istTimeSeconds(updatedAt) : ""} को अपडेट हुआ।`,
                    `Live. ${updatedAt ? istTimeSeconds(updatedAt) : ""} ko update hua.`,
                  )}{" "}
              {l(
                `Refreshes every ${seconds} seconds while this tab is open.`,
                `यह टैब खुला रहने तक हर ${seconds} सेकंड में अपडेट होता है।`,
                `Yeh tab khula rehne tak har ${seconds} second mein update hota hai.`,
              )}
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
