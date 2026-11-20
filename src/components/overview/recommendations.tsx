"use client";

import Link from "next/link";
import { T, useL, type L } from "@/lib/ui/lang";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { rupees } from "@/lib/format";
import type {
  Recommendation,
  RecModule,
} from "@/lib/analytics/recommendations";
import type { ApiState } from "@/lib/ui/api";
import { Region } from "./region";
import type { OverviewPayload } from "./types";

const FIRST = 5;

const MODULE: Record<RecModule, { href: string; word: (l: L) => string }> = {
  inventory: {
    href: "/dashboard/inventory",
    word: (l) => l("Stock", "स्टॉक", "Stock"),
  },
  vendors: {
    href: "/dashboard/vendors",
    word: (l) => l("Suppliers", "सप्लायर", "Supplier"),
  },
  khata: { href: "/dashboard/khata", word: (l) => l("Khata", "खाता", "Khata") },
  growth: {
    href: "/dashboard/growth",
    word: (l) => l("Growth", "ग्रोथ", "Growth"),
  },
};

function Item({ rec, rank }: { rec: Recommendation; rank: number }) {
  const l = useL();
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
          {rec.pinned ? (
            <Badge tone="warn">
              {l("Do this first", "पहले यह", "Pehle yeh")}
            </Badge>
          ) : null}
          <span>{m.word(l)}</span>
          {rec.impactPaise > 0 ? (
            <span className="num">
              {l("Impact", "असर", "Asar")} {rupees(rec.impactPaise)}
            </span>
          ) : null}
          <span className="num">
            {l("Confidence", "भरोसा", "Bharosa")}{" "}
            {Math.round(rec.confidence * 100)}%
          </span>
        </p>
      </div>
    </li>
  );
}

function List({ recs }: { recs: Recommendation[] }) {
  const l = useL();
  const [all, setAll] = useState(false);
  if (recs.length === 0)
    return (
      <EmptyState
        title={l(
          "No suggestions yet",
          "अभी कोई सुझाव नहीं",
          "Abhi koi suggestion nahi",
        )}
        description={l(
          "When stock, khata or a supplier payment goes wrong, the most urgent task will appear here at the top.",
          "स्टॉक, खाता या सप्लायर पेमेंट में कुछ बिगड़ने पर सबसे ज़रूरी काम यहाँ सबसे ऊपर आएगा।",
          "Stock, khata ya vendor payment mein kuch bigadne par sabse zaroori kaam yahan sabse upar aayega.",
        )}
        action={
          <Link
            href="/dashboard/growth"
            className={buttonClass({ variant: "secondary" })}
          >
            {l("See Growth", "ग्रोथ देखें", "Growth dekho")}
          </Link>
        }
      />
    );
  const shown = all ? recs : recs.slice(0, FIRST);
  return (
    <>
      <ol
        className="ov-recs"
        aria-label={l(
          "Suggestions, most important first",
          "सुझाव, सबसे ज़रूरी पहले",
          "Suggestions, sabse zaroori pehle",
        )}
      >
        {shown.map((r, i) => (
          <Item key={r.id} rec={r} rank={i + 1} />
        ))}
      </ol>
      {recs.length > FIRST ? (
        <div className="ov-recs-more">
          <Button
            variant="quiet"
            aria-expanded={all}
            onClick={() => setAll((v) => !v)}
          >
            {all
              ? l("Show fewer", "कम दिखाएँ", "Kam dikhao")
              : l(
                  `Show ${recs.length - FIRST} more suggestions`,
                  `बाक़ी ${recs.length - FIRST} सुझाव दिखाएँ`,
                  `Baaki ${recs.length - FIRST} suggestions dikhao`,
                )}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** What to do next, in the order the engine ranked it (bills due soon first, then impact times confidence). */
export function Recommendations({
  state,
}: {
  state: ApiState<OverviewPayload>;
}) {
  const l = useL();
  return (
    <section aria-labelledby="recs-h" className="ov-sec">
      <div className="ov-head">
        <h2 id="recs-h">
          <T k="ov.todo" />
        </h2>
      </div>
      <Region
        state={state}
        errorTitle={l(
          "Could not load suggestions",
          "सुझाव नहीं खुल पाए",
          "Suggestions nahi khul paye",
        )}
        skeleton={
          <Skeleton
            shape="rows"
            count={4}
            cols={2}
            label={l(
              "Loading suggestions",
              "सुझाव लोड हो रहे हैं",
              "Suggestions load ho rahe hain",
            )}
          />
        }
      >
        {(d) => <List recs={d.recommendations} />}
      </Region>
    </section>
  );
}
