"use client";

import type {
  FestivalPlan,
  FestivalPlanItem,
  UpcomingFestival,
} from "@/lib/analytics/festival";
import {
  Badge,
  DataTable,
  Disclosure,
  EmptyState,
  Stat,
  Stats,
  type Column,
} from "@/components/ui";
import { num, rupees } from "@/lib/format";
import { dayLabel, humanize } from "@/lib/ui/ist-labels";
import { useL, type L } from "@/lib/ui/lang";

const festivalCols = (l: L): readonly Column<UpcomingFestival>[] => [
  {
    key: "name",
    header: l("Festival", "त्योहार", "Tyohaar"),
    primary: true,
    cell: (f) => f.name,
  },
  {
    key: "date",
    header: l("Date", "तारीख़", "Tarikh"),
    cell: (f) => dayLabel(f.date),
  },
  {
    key: "away",
    header: l("Days away", "कितने दिन बाक़ी", "Kitne din baaki"),
    num: true,
    cell: (f) => num(f.daysAway),
  },
  {
    key: "cats",
    header: l(
      "Categories that sell more",
      "जो श्रेणियाँ ज़्यादा बिकती हैं",
      "Jo categories zyada bikti hain",
    ),
    cell: (f) => f.categories.map(humanize).join(", "),
  },
];

const itemCols = (l: L): readonly Column<FestivalPlanItem>[] => [
  {
    key: "name",
    header: l("Item", "आइटम", "Item"),
    primary: true,
    cell: (i) => (
      <>
        {i.name}
        <span className="gr-sub">
          {humanize(i.category)},{" "}
          {l(
            `sells ${num(i.baselinePerDay, 1)} a day now`,
            `अभी रोज़ ${num(i.baselinePerDay, 1)} बिकता है`,
            `abhi roz ${num(i.baselinePerDay, 1)} bikta hai`,
          )}
        </span>
      </>
    ),
  },
  {
    key: "up",
    header: l("Festival uplift", "त्योहार में बढ़त", "Tyohaar mein badhat"),
    num: true,
    cell: (i) => (
      <>
        {num(i.uplift, 1)}x
        <span className="gr-sub">
          {i.learned
            ? l(
                "from your past festivals",
                "आपके पिछले त्योहारों से",
                "aapke pichhle tyohaaron se",
              )
            : l("default estimate", "सामान्य अनुमान", "default anumaan")}
        </span>
      </>
    ),
  },
  {
    key: "extra",
    header: l(
      "Extra units to stock",
      "अतिरिक्त स्टॉक की इकाइयाँ",
      "Extra units stock karne ke liye",
    ),
    num: true,
    cell: (i) => num(i.extraUnits),
  },
  {
    key: "impact",
    header: l("Extra profit", "अतिरिक्त मुनाफ़ा", "Extra munafa"),
    num: true,
    cell: (i) => rupees(i.impactPaise),
  },
];

const TOP_ITEMS = 8;

function PlanSection({ plan }: { plan: FestivalPlan }) {
  const l = useL();
  const f = plan.festival;
  const sorted = [...plan.items].sort((a, b) => b.impactPaise - a.impactPaise);
  const top = sorted.slice(0, TOP_ITEMS);
  const rest = sorted.slice(TOP_ITEMS);
  return (
    <section
      className="gr-sec"
      aria-label={l(
        `${f.name} stock-up plan`,
        `${f.name} की स्टॉक योजना`,
        `${f.name} ki stock yojana`,
      )}
    >
      <div className="gr-head">
        <h3>
          {f.name}, {dayLabel(f.date)}
        </h3>
        <p>
          {f.daysAway === 0
            ? l("Today.", "आज।", "Aaj.")
            : l(
                `${num(f.daysAway)} ${f.daysAway === 1 ? "day" : "days"} away.`,
                `${num(f.daysAway)} दिन बाक़ी।`,
                `${num(f.daysAway)} din baaki.`,
              )}{" "}
          {l(
            "Extra profit is the extra units you can sell in the festival window, times your margin.",
            "अतिरिक्त मुनाफ़ा त्योहार के दिनों में बिकने वाली अतिरिक्त इकाइयों को आपके मार्जिन से गुणा करके बनता है।",
            "Extra munafa tyohaar ke dinon mein bikne wali extra units ko aapke margin se guna karke banta hai.",
          )}
        </p>
      </div>
      <DataTable
        caption={l(
          `${f.name} stock-up plan, biggest gain first`,
          `${f.name} की स्टॉक योजना, सबसे ज़्यादा फ़ायदा पहले`,
          `${f.name} ki stock yojana, sabse zyada faayda pehle`,
        )}
        columns={itemCols(l)}
        rows={top}
        rowKey={(i) => i.productId}
        dense
        empty={
          <EmptyState
            title={l(
              "No sold items in these categories",
              "इन श्रेणियों में कोई बिका आइटम नहीं",
              "In categories mein koi bika item nahi",
            )}
            description={l(
              "Items appear here once they have sales history.",
              "बिक्री का रिकॉर्ड बनने पर आइटम यहाँ दिखेंगे।",
              "Bikri ka record banne par items yahan dikhenge.",
            )}
          />
        }
      />
      {rest.length > 0 ? (
        <Disclosure
          summary={l(
            `Show ${num(rest.length)} more items`,
            `${num(rest.length)} और आइटम दिखाएँ`,
            `${num(rest.length)} aur items dikhao`,
          )}
        >
          <DataTable
            caption={l(
              `${f.name} stock-up plan, remaining items`,
              `${f.name} की स्टॉक योजना, बाक़ी आइटम`,
              `${f.name} ki stock yojana, baaki items`,
            )}
            columns={itemCols(l)}
            rows={rest}
            rowKey={(i) => i.productId}
            dense
          />
        </Disclosure>
      ) : null}
      {plan.items.length > 0 ? (
        <Stats>
          <Stat
            label={l(
              "Total extra profit if stocked",
              "स्टॉक करने पर कुल अतिरिक्त मुनाफ़ा",
              "Stock karne par kul extra munafa",
            )}
            figure={rupees(plan.totalImpactPaise)}
            tone="success"
          />
        </Stats>
      ) : null}
    </section>
  );
}

export function FestivalTab({
  festivals,
  plans,
}: {
  festivals: UpcomingFestival[];
  plans: FestivalPlan[];
}) {
  const l = useL();
  if (festivals.length === 0) {
    return (
      <EmptyState
        title={l(
          "No festival in the next 60 days",
          "अगले 60 दिन में कोई त्योहार नहीं",
          "Agle 60 din mein koi tyohaar nahi",
        )}
        description={l(
          "When a festival comes within 60 days, its stock-up plan shows here.",
          "60 दिन के भीतर कोई त्योहार आने पर उसकी स्टॉक योजना यहाँ दिखेगी।",
          "60 din ke andar koi tyohaar aane par uski stock yojana yahan dikhegi.",
        )}
      />
    );
  }
  const next = festivals[0];
  return (
    <div>
      <section
        className="gr-sec"
        aria-label={l(
          "Upcoming festivals",
          "आने वाले त्योहार",
          "Aane wale tyohaar",
        )}
      >
        <div className="gr-head">
          <h2>
            {l("Upcoming festivals", "आने वाले त्योहार", "Aane wale tyohaar")}
          </h2>
          <p>
            {l("Next is", "अगला है", "Agla hai")}{" "}
            <Badge tone="info">{next.name}</Badge> {l("on", "तारीख़", "tarikh")}{" "}
            {dayLabel(next.date)}.
          </p>
        </div>
        <DataTable
          caption={l(
            "Upcoming festivals",
            "आने वाले त्योहार",
            "Aane wale tyohaar",
          )}
          columns={festivalCols(l)}
          rows={festivals}
          rowKey={(f) => `${f.name}-${f.date}`}
          dense
        />
      </section>
      {plans.length === 0 ? (
        <section className="gr-sec">
          <EmptyState
            title={l(
              "No stock-up plan yet",
              "अभी कोई स्टॉक योजना नहीं",
              "Abhi koi stock yojana nahi",
            )}
            description={l(
              "Plans need items sold in the festival categories.",
              "योजना के लिए त्योहार की श्रेणियों के बिके आइटम चाहिए।",
              "Yojana ke liye tyohaar ki categories ke bike items chahiye.",
            )}
          />
        </section>
      ) : (
        plans.map((p) => (
          <PlanSection key={`${p.festival.name}-${p.festival.date}`} plan={p} />
        ))
      )}
    </div>
  );
}
