"use client";

import Link from "next/link";
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
  const items = itemsText(row.items);
  const main = row.payer ?? (items || (row.kind === "refund" ? "Paisa wapas kiya" : "Item match nahi hua"));
  const sub = row.payer && items ? items : sourceText(row);
  return (
    <>
      <span className={row.payer || items || row.kind === "refund" ? "rz-main" : "rz-main rz-muted"}>
        {row.kind === "refund" ? <Badge tone="danger">Refund</Badge> : null} {main}
      </span>
      {sub ? <span className="rz-sub">{sub}</span> : null}
      <span className="rz-sub rz-inline">{METHOD_WORD[row.method]}</span>
    </>
  );
}

function Line({ row }: { row: RozmelRow }) {
  const out = row.amountPaise < 0;
  return (
    <tr>
      <td className="rz-time num" data-label="Time">
        {istClock(row.at)}
      </td>
      <td className="rz-det" data-label="Details">
        <Details row={row} />
      </td>
      <td className="rz-col-method" data-label="Method">
        {METHOD_WORD[row.method]}
      </td>
      <td className={out ? "num rz-out" : "num rz-in"} data-label="Amount">
        <span>{out ? bookMoney(row.amountPaise) : `+${bookMoney(row.amountPaise)}`}</span>
        <span className="rz-sub rz-inline">Kul {rupees(row.runningTotalPaise)}</span>
      </td>
      <td className="num rz-col-run" data-label="Running total">
        {rupees(row.runningTotalPaise)}
      </td>
    </tr>
  );
}

function Book({ data }: { data: RozmelPayload }) {
  const [all, setAll] = useState(false);
  const newestFirst = [...data.rows].reverse();
  const shown = all ? newestFirst : newestFirst.slice(0, FIRST);
  const hidden = newestFirst.length - shown.length;

  if (data.count === 0)
    return (
      <EmptyState
        title="Aaj abhi tak koi bikri nahi"
        description="Pehla payment aate hi yahan ek line ban jayegi, jod ke saath."
        action={
          <Link href="/soundbox" className={buttonClass({ variant: "secondary" })}>
            Soundbox kholo
          </Link>
        }
      />
    );

  return (
    <>
      <Table caption={`Rozmel, ${longDay(data.day)}, sabse nayi line upar`} restack={false} className="rz">
        <thead>
          <tr>
            <th scope="col" className="rz-th-time">
              Time
            </th>
            <th scope="col">Details</th>
            <th scope="col" className="rz-col-method">
              Method
            </th>
            <th scope="col" className="num">
              Amount
            </th>
            <th scope="col" className="num rz-col-run">
              Running total
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
          <Button variant="secondary" onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? `Sirf nayi ${FIRST} lines dikhao` : `Baaki ${hidden} lines dikhao`}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** The signature object: today's receipts as a ruled running day-book, newest line on top. */
export function Rozmel() {
  const state = useApi<RozmelPayload>("/api/dashboard/rozmel");
  const d = state.data;
  return (
    <section aria-labelledby="rozmel-h" className="ov-sec">
      <div className="ov-head ov-head-main">
        <h2 id="rozmel-h">
          Aaj ka rozmel <span className="deva ov-hi" lang="hi">रोज़मेल</span>
        </h2>
        <p className="ov-headmeta num" aria-live="polite">
          {d && !state.error ? (d.count === 0 ? longDay(d.day) : `${longDay(d.day)}, ${d.count} lines, ab tak kul ${rupees(d.totalPaise)}`) : null}
        </p>
        <Button variant="quiet" icon={<RefreshIcon size={16} />} loading={state.loading && !!d} onClick={state.refetch}>
          Naya dekho
        </Button>
      </div>
      <Region state={state} keepStale errorTitle="Rozmel nahi khul paya" skeleton={<Skeleton shape="rows" count={7} cols={4} label="Rozmel load ho raha hai" />}>
        {(data) => <Book data={data} />}
      </Region>
    </section>
  );
}
