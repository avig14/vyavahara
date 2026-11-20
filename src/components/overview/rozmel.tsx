"use client";

import Link from "next/link";
import { T, useL } from "@/lib/ui/lang";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RefreshIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Table } from "@/components/ui/table";
import { rupees } from "@/lib/format";
import { useApi } from "@/lib/ui/api";
import { longDay, istClock } from "@/lib/ui/dates";
import { bookMoney, itemsText, METHOD_WORD, sourceText } from "./lines";
import { Region } from "./region";
import type { RozmelPayload, RozmelRow } from "./types";

/** Lines shown before "baaki dikhao"; the rest of the day stays one press away. */
const FIRST = 10;

function Details({ row }: { row: RozmelRow }) {
  const l = useL();
  const items = itemsText(row.items, l);
  const main =
    row.payer ??
    (items ||
      (row.kind === "refund"
        ? l("Money returned", "पैसा वापस किया", "Paisa wapas kiya")
        : l("Item not matched", "आइटम मिला नहीं", "Item match nahi hua")));
  const sub = row.payer && items ? items : sourceText(row, l);
  return (
    <>
      <span
        className={
          row.payer || items || row.kind === "refund"
            ? "rz-main"
            : "rz-main rz-muted"
        }
      >
        {row.kind === "refund" ? (
          <Badge tone="danger">{l("Refund", "रिफंड", "Refund")}</Badge>
        ) : null}{" "}
        {main}
      </span>
      {sub ? <span className="rz-sub">{sub}</span> : null}
      <span className="rz-sub rz-inline">{METHOD_WORD[row.method]}</span>
    </>
  );
}

function Line({ row }: { row: RozmelRow }) {
  const l = useL();
  const out = row.amountPaise < 0;
  return (
    <tr>
      <td className="rz-time num" data-label={l("Time", "समय", "Time")}>
        {istClock(row.at)}
      </td>
      <td className="rz-det" data-label={l("Details", "ब्योरा", "Details")}>
        <Details row={row} />
      </td>
      <td className="rz-col-method" data-label={l("Method", "तरीका", "Method")}>
        {METHOD_WORD[row.method]}
      </td>
      <td
        className={out ? "num rz-out" : "num rz-in"}
        data-label={l("Amount", "रक़म", "Amount")}
      >
        <span>
          {out ? bookMoney(row.amountPaise) : `+${bookMoney(row.amountPaise)}`}
        </span>
        <span className="rz-sub rz-inline">
          {l("Total", "कुल", "Kul")} {rupees(row.runningTotalPaise)}
        </span>
      </td>
      <td
        className="num rz-col-run"
        data-label={l("Running total", "जोड़", "Running total")}
      >
        {rupees(row.runningTotalPaise)}
      </td>
    </tr>
  );
}

function Book({ data }: { data: RozmelPayload }) {
  const l = useL();
  const [all, setAll] = useState(false);
  const newestFirst = [...data.rows].reverse();
  const shown = all ? newestFirst : newestFirst.slice(0, FIRST);
  const hidden = newestFirst.length - shown.length;

  if (data.count === 0)
    return (
      <EmptyState icon="rozmel"
        title={l(
          "No sales yet today",
          "आज अभी तक कोई बिक्री नहीं",
          "Aaj abhi tak koi bikri nahi",
        )}
        description={l(
          "As soon as the first payment arrives, a line will appear here with the running total.",
          "पहला पेमेंट आते ही यहाँ जोड़ के साथ एक लाइन बन जाएगी।",
          "Pehla payment aate hi yahan ek line ban jayegi, jod ke saath.",
        )}
        action={
          <Link
            href="/soundbox"
            className={buttonClass({ variant: "secondary" })}
          >
            {l("Open Soundbox", "साउंडबॉक्स खोलें", "Soundbox kholo")}
          </Link>
        }
      />
    );

  return (
    <>
      <Table
        caption={l(
          `Rozmel, ${longDay(data.day)}, newest line on top`,
          `रोज़मेल, ${longDay(data.day)}, सबसे नई लाइन ऊपर`,
          `Rozmel, ${longDay(data.day)}, sabse nayi line upar`,
        )}
        restack={false}
        className="rz"
      >
        <thead>
          <tr>
            <th scope="col" className="rz-th-time">
              {l("Time", "समय", "Time")}
            </th>
            <th scope="col">{l("Details", "ब्योरा", "Details")}</th>
            <th scope="col" className="rz-col-method">
              {l("Method", "तरीका", "Method")}
            </th>
            <th scope="col" className="num">
              {l("Amount", "रक़म", "Amount")}
            </th>
            <th scope="col" className="num rz-col-run">
              {l("Running total", "जोड़", "Running total")}
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <Line key={r.id} row={r} />
          ))}
        </tbody>
      </Table>
      {newestFirst.length > FIRST ? (
        <div className="rz-more">
          <Button
            variant="secondary"
            onClick={() => setAll((v) => !v)}
            aria-expanded={all}
          >
            {all
              ? l(
                  `Show only the newest ${FIRST} lines`,
                  `सिर्फ़ नई ${FIRST} लाइनें दिखाएँ`,
                  `Sirf nayi ${FIRST} lines dikhao`,
                )
              : l(
                  `Show ${hidden} more lines`,
                  `बाक़ी ${hidden} लाइनें दिखाएँ`,
                  `Baaki ${hidden} lines dikhao`,
                )}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** The signature object: today's receipts as a ruled running day-book, newest line on top. */
export function Rozmel() {
  const l = useL();
  const state = useApi<RozmelPayload>("/api/dashboard/rozmel");
  const d = state.data;
  return (
    <section aria-labelledby="rozmel-h" className="ov-sec">
      <div className="ov-head ov-head-main">
        <h2 id="rozmel-h">
          <T k="ov.rozmel" />
        </h2>
        <p className="ov-headmeta num" aria-live="polite">
          {d && !state.error
            ? d.count === 0
              ? longDay(d.day)
              : l(
                  `${longDay(d.day)}, ${d.count} lines, total so far ${rupees(d.totalPaise)}`,
                  `${longDay(d.day)}, ${d.count} लाइनें, अब तक कुल ${rupees(d.totalPaise)}`,
                  `${longDay(d.day)}, ${d.count} lines, ab tak kul ${rupees(d.totalPaise)}`,
                )
            : null}
        </p>
        <Button
          variant="quiet"
          icon={<RefreshIcon size={16} />}
          loading={state.loading && !!d}
          onClick={state.refetch}
        >
          <T k="ov.refresh" />
        </Button>
      </div>
      <Region
        state={state}
        keepStale
        errorTitle={l(
          "Could not load the rozmel",
          "रोज़मेल नहीं खुल पाया",
          "Rozmel nahi khul paya",
        )}
        skeleton={
          <Skeleton
            shape="rows"
            count={7}
            cols={4}
            label={l(
              "Loading the rozmel",
              "रोज़मेल लोड हो रहा है",
              "Rozmel load ho raha hai",
            )}
          />
        }
      >
        {(data) => <Book data={data} />}
      </Region>
    </section>
  );
}
