"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { rupees } from "@/lib/format";
import type { Recommendation, RecModule } from "@/lib/analytics/recommendations";
import type { ApiState } from "@/lib/ui/api";
import { Region } from "./region";
import type { OverviewPayload } from "./types";

const FIRST = 5;

const MODULE: Record<RecModule, { href: string; word: string }> = {
  inventory: { href: "/dashboard/inventory", word: "Stock" },
  vendors: { href: "/dashboard/vendors", word: "Suppliers" },
  khata: { href: "/dashboard/khata", word: "Khata" },
  growth: { href: "/dashboard/growth", word: "Growth" },
};

function Item({ rec, rank }: { rec: Recommendation; rank: number }) {
  const m = MODULE[rec.module];
  return (
    <li className="ov-rec">
      <span className="ov-rank num" aria-hidden="true">
        {rank}
      </span>
      <div className="ov-rec-body">
        <Link href={m.href} className="ov-rec-title">
          {rec.title}
        </Link>
        <p className="ov-rec-meta">
          {rec.pinned ? <Badge tone="warn">Pehle yeh</Badge> : null}
          <span>{m.word}</span>
          {rec.impactPaise > 0 ? <span className="num">Asar {rupees(rec.impactPaise)}</span> : null}
          <span className="num">Bharosa {Math.round(rec.confidence * 100)}%</span>
        </p>
      </div>
    </li>
  );
}

function List({ recs }: { recs: Recommendation[] }) {
  const [all, setAll] = useState(false);
  if (recs.length === 0)
    return (
      <EmptyState
        title="Abhi koi suggestion nahi"
        description="Stock, khata ya vendor payment mein kuch bigadne par sabse zaroori kaam yahan sabse upar aayega."
        action={
          <Link href="/dashboard/growth" className={buttonClass({ variant: "secondary" })}>
            Growth dekho
          </Link>
        }
      />
    );
  const shown = all ? recs : recs.slice(0, FIRST);
  return (
    <>
      <ol className="ov-recs" aria-label="Suggestions, sabse zaroori pehle">
        {shown.map((r, i) => (
          <Item key={r.id} rec={r} rank={i + 1} />
        ))}
      </ol>
      {recs.length > FIRST ? (
        <div className="ov-recs-more">
          <Button variant="quiet" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? "Kam dikhao" : `Baaki ${recs.length - FIRST} suggestions dikhao`}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** What to do next, in the order the engine ranked it (bills due soon first, then impact times confidence). */
export function Recommendations({ state }: { state: ApiState<OverviewPayload> }) {
  return (
    <section aria-labelledby="recs-h" className="ov-sec">
      <div className="ov-head">
        <h2 id="recs-h">Ab kya karna hai</h2>
      </div>
      <Region state={state} errorTitle="Suggestions nahi khul paye" skeleton={<Skeleton shape="rows" count={4} cols={2} label="Suggestions load ho rahe hain" />}>
        {(d) => <List recs={d.recommendations} />}
      </Region>
    </section>
  );
}
