"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { rupees } from "@/lib/format";
import type { ApiState } from "@/lib/ui/api";
import { useActionState } from "@/lib/ui/action-state";
import { useL } from "@/lib/ui/lang";
import { confidenceWord, describeRec } from "@/lib/ui/rec-copy";
import type { Recommendation } from "@/lib/analytics/recommendations";
import { Region } from "./region";
import type { OverviewPayload } from "./types";

const FIRST = 3;
const MAX = 8;

function Row({
  rec,
  rank,
  onDone,
  onLater,
}: {
  rec: Recommendation;
  rank: number;
  onDone: () => void;
  onLater: () => void;
}) {
  const l = useL();
  const c = describeRec(rec, l, rupees);
  return (
    <li className="act">
      <span className="act-rank num" aria-hidden="true">
        {rank}
      </span>
      <div className="act-body">
        <h3 className="act-title">{c.title}</h3>
        {c.why ? <p className="act-why">{c.why}</p> : null}
        {c.result ? (
          <p className="act-result">
            <span className="act-tag">{l("Estimate", "अनुमान", "Anumaan")}</span>{" "}
            {c.result}
          </p>
        ) : null}
        <p className="act-conf">{confidenceWord(rec.confidence, l)}</p>
        <div className="act-btns">
          <Link
            href={c.cta.href}
            className={buttonClass({
              variant: "secondary",
            })}
          >
            {c.cta.label}
          </Link>
          {c.whatsapp ? (
            <a
              className={buttonClass({ variant: "secondary" })}
              href={`https://wa.me/?text=${encodeURIComponent(c.whatsapp)}`}
              target="_blank"
              rel="noreferrer"
            >
              {l("Message on WhatsApp", "WhatsApp पर भेजें", "WhatsApp par bhejo")}
            </a>
          ) : null}
          <Button variant="quiet" onClick={onDone}>
            {l("Done", "हो गया", "Ho gaya")}
          </Button>
          <Button variant="quiet" onClick={onLater}>
            {l("Later", "बाद में", "Baad mein")}
          </Button>
        </div>
      </div>
    </li>
  );
}

function Body({ recs, summary }: { recs: Recommendation[]; summary: string }) {
  const l = useL();
  const acts = useActionState();
  const [all, setAll] = useState(false);
  const [undoId, setUndoId] = useState<string | null>(null);
  // keep the engine's order, but no more than two from one area (stock, suppliers, khata, growth) until the top few are filled
  const visible = recs.filter((r) => !acts.hidden(r.id));
  const taken: Record<string, number> = {};
  const lead: Recommendation[] = [];
  for (const r of visible) {
    if (lead.length >= FIRST) break;
    if ((taken[r.module] ?? 0) >= 2) continue;
    taken[r.module] = (taken[r.module] ?? 0) + 1;
    lead.push(r);
  }
  const open = [...lead, ...visible.filter((r) => !lead.includes(r))].slice(
    0,
    MAX,
  );
  const shown = all ? open : open.slice(0, FIRST);
  const hiddenCount = recs.filter((r) => acts.hidden(r.id)).length;

  return (
    <>
      {undoId ? (
        <p className="act-undo" role="status" aria-live="polite">
          {l(
            "Removed from today's list.",
            "आज की सूची से हटा दिया।",
            "Aaj ki list se hata diya.",
          )}{" "}
          <button
            type="button"
            className="act-undo-btn"
            onClick={() => {
              acts.undo(undoId);
              setUndoId(null);
            }}
          >
            {l("Undo", "वापस लाएँ", "Wapas lao")}
          </button>
        </p>
      ) : null}
      {open.length === 0 ? (
        <EmptyState
          icon="saathi"
          title={l(
            "Nothing urgent today",
            "आज कुछ ज़रूरी नहीं",
            "Aaj kuch zaroori nahi",
          )}
          description={summary}
          action={
            hiddenCount > 0 ? (
              <Button
                variant="secondary"
                onClick={() => recs.forEach((r) => acts.undo(r.id))}
              >
                {l(
                  `Show ${hiddenCount} hidden`,
                  `${hiddenCount} छुपे हुए दिखाएँ`,
                  `${hiddenCount} chhupe hue dikhao`,
                )}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ol className="act-list">
          {shown.map((r, i) => (
            <Row
              key={r.id}
              rec={r}
              rank={i + 1}
              onDone={() => {
                acts.markDone(r.id);
                setUndoId(r.id);
              }}
              onLater={() => {
                acts.later(r.id);
                setUndoId(r.id);
              }}
            />
          ))}
        </ol>
      )}
      {open.length > FIRST ? (
        <div className="ov-recs-more">
          <Button
            variant="quiet"
            aria-expanded={all}
            onClick={() => setAll((v) => !v)}
          >
            {all
              ? l("Show fewer", "कम दिखाएँ", "Kam dikhao")
              : l(
                  `Show ${open.length - FIRST} more`,
                  `${open.length - FIRST} और दिखाएँ`,
                  `${open.length - FIRST} aur dikhao`,
                )}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** Today's most useful things to do, ranked by the recommendation engine. Hidden items return after a day (later) or a week (done) if still true. */
export function ActionCentre({ state }: { state: ApiState<OverviewPayload> }) {
  const l = useL();
  return (
    <section aria-labelledby="act-h" className="ov-sec act-sec">
      <div className="ov-head">
        <h2 id="act-h">
          {l("Today's important tasks", "आज के ज़रूरी काम", "Aaj ke zaroori kaam")}
        </h2>
        <p className="ov-headmeta">
          {l(
            "Most important first. You decide what to do.",
            "सबसे ज़रूरी पहले। करना क्या है, आप तय करें।",
            "Sabse zaroori pehle. Karna kya hai, aap tay karo.",
          )}
        </p>
      </div>
      <Region
        state={state}
        errorTitle={l(
          "Could not load today's tasks",
          "आज के काम नहीं खुल पाए",
          "Aaj ke kaam nahi khul paye",
        )}
        skeleton={
          <Skeleton
            shape="rows"
            count={3}
            cols={2}
            label={l(
              "Loading today's tasks",
              "आज के काम लोड हो रहे हैं",
              "Aaj ke kaam load ho rahe hain",
            )}
          />
        }
      >
        {(d) => (
          <Body
            recs={d.recommendations}
            summary={l(
              `Sales ${rupees(d.report.sales.totalPaise)} from ${d.report.sales.bills} bills. Stock, khata and supplier payments look fine.`,
              `${d.report.sales.bills} बिलों से ${rupees(d.report.sales.totalPaise)} की बिक्री। स्टॉक, खाता और सप्लायर पेमेंट ठीक हैं।`,
              `${d.report.sales.bills} bills se ${rupees(d.report.sales.totalPaise)} ki bikri. Stock, khata aur supplier payment theek hain.`,
            )}
          />
        )}
      </Region>
    </section>
  );
}
