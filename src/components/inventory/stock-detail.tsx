"use client";

import { StockRunway } from "./stock-runway";
import { useEffect, useRef } from "react";
import { LineBand } from "@/components/charts";
import { Badge, Button, Disclosure, Table } from "@/components/ui";
import { num, rupees } from "@/lib/format";
import { dayKeyLabel } from "@/lib/ui/stock-dates";
import { LostTable } from "./lost-sales";
import { daysText, statusMeta } from "./status";
import { useL } from "@/lib/ui/lang";
import { describeRec } from "@/lib/ui/rec-copy";
import type { InventoryPayload, ItemForecast } from "./types";

export interface StockDetailProps {
  item: ItemForecast;
  data: InventoryPayload;
  onClose: () => void;
  /** move focus to the heading: only after a person picked the row, not on page load */
  takeFocus: boolean;
}

const q1 = (n: number) => num(n, 1);

/** The detail for one product. Every figure is the API's; the chart plots its 14-day forecast and band, nothing else. */
export function StockDetail({
  item,
  data,
  onClose,
  takeFocus,
}: StockDetailProps) {
  const head = useRef<HTMLHeadingElement>(null);
  // a person picked this product: bring the reader to it (matters on a phone, where it sits above the table)
  useEffect(() => {
    if (takeFocus) head.current?.focus();
    // only when the product changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.productId]);

  const l = useL();
  const meta = statusMeta(l)[item.status];
  const rec = data.recommendations.find(
    (r) => r.id.endsWith(`:${item.productId}`) && !r.id.startsWith("ADD_LOST"),
  );
  const lost = data.lostDemand.rows.filter(
    (l) => l.productId === item.productId,
  );
  const lostTotal = lost.reduce((s, x) => s + x.estValuePaise, 0);
  const orderNow = item.status === "stockout" || item.status === "reorder";
  const points = item.daily.map((d) => ({
    label: dayKeyLabel(d.date),
    forecast: d.yhat,
    low: d.lo,
    high: d.hi,
  }));
  const first = item.daily[0];
  const last = item.daily[item.daily.length - 1];
  const total = item.daily.reduce((s, d) => s + d.yhat, 0);
  const summary =
    first && last
      ? l(
          `Forecast of daily units sold for ${item.name}, ${dayKeyLabel(first.date)} to ${dayKeyLabel(last.date)}: about ${q1(total)} units in all, from ${q1(first.yhat)} a day at the start to ${q1(last.yhat)} a day at the end, with a likely range around each day.`,
          `${item.name} की रोज़ की बिक्री का अनुमान, ${dayKeyLabel(first.date)} से ${dayKeyLabel(last.date)}: कुल करीब ${q1(total)} इकाई, शुरू में रोज़ ${q1(first.yhat)} से आख़िर में रोज़ ${q1(last.yhat)} तक, हर दिन के आसपास संभावित दायरे के साथ।`,
          `${item.name} ki roz ki bikri ka anumaan, ${dayKeyLabel(first.date)} se ${dayKeyLabel(last.date)}: kul lagbhag ${q1(total)} unit, shuru mein roz ${q1(first.yhat)} se aakhir mein roz ${q1(last.yhat)} tak, har din ke aaspaas sambhavit daayre ke saath.`,
        )
      : l(
          `No forecast for ${item.name}.`,
          `${item.name} का अनुमान नहीं है।`,
          `${item.name} ka anumaan nahi hai.`,
        );

  return (
    <section className="stk-sec" aria-labelledby="stk-detail-title">
      <div className="stk-title">
        <h2 id="stk-detail-title" className="stk-h" ref={head} tabIndex={-1}>
          {item.name}
        </h2>
        <div className="stk-title-meta">
          <span>{item.category}</span>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
        <Button variant="quiet" className="stk-back" onClick={onClose}>
          {l("Close", "बंद करें", "Band karo")}
        </Button>
      </div>

      {rec ? (
        <p className="stk-rec">{describeRec(rec, l, rupees).title}</p>
      ) : null}

      {orderNow ? (
        <p className="stk-order">
          {item.suggestedOrderQty > 0 ? (
            <>
              <span className="figure stk-big">
                {num(item.suggestedOrderQty)}
              </span>{" "}
              <span>
                {l(
                  `to order. Delivery takes ${num(item.leadTimeDays)} days.`,
                  `मँगवाएँ। डिलीवरी में ${num(item.leadTimeDays)} दिन लगते हैं।`,
                  `mangwao. Delivery mein ${num(item.leadTimeDays)} din lagte hain.`,
                )}
              </span>
            </>
          ) : (
            <span>
              {l(
                "No order quantity yet.",
                "ऑर्डर की मात्रा अभी नहीं बनी।",
                "Order ki quantity abhi nahi bani.",
              )}
            </span>
          )}
        </p>
      ) : null}

      <StockRunway item={item} />

      <dl className="facts">
        <div>
          <dt>{l("On hand", "स्टॉक में", "Stock mein")}</dt>
          <dd>{q1(item.stock)}</dd>
        </div>
        <div>
          <dt>{l("Sold today", "आज बिका", "Aaj bika")}</dt>
          <dd>{q1(item.soldToday)}</dd>
        </div>
        <div>
          <dt>{l("Days of cover", "बचे दिन", "Bache din")}</dt>
          <dd>{daysText(item.coverDays, l)}</dd>
        </div>
        <div>
          <dt>{l("Runs out in", "ख़त्म होने में", "Khatam hone mein")}</dt>
          <dd>
            {daysText(item.daysToStockout, l)}
            <small>
              {daysText(item.daysToStockoutRange[0], l)} {l("to", "से", "se")}{" "}
              {daysText(item.daysToStockoutRange[1], l)}
            </small>
          </dd>
        </div>
        <div>
          <dt>{l("Reorder point", "रीऑर्डर पॉइंट", "Reorder point")}</dt>
          <dd>{q1(item.reorderPoint)}</dd>
        </div>
        <div>
          <dt>{l("Safety stock", "सुरक्षित स्टॉक", "Safety stock")}</dt>
          <dd>{q1(item.safetyStock)}</dd>
        </div>
        <div>
          <dt>{l("Delivery time", "डिलीवरी का समय", "Delivery time")}</dt>
          <dd>
            {num(item.leadTimeDays)} {l("days", "दिन", "din")}
          </dd>
        </div>
      </dl>

      <h3 className="stk-h3">
        {l(
          "Next 14 days of sales (forecast)",
          "अगले 14 दिन की बिक्री (अनुमान)",
          "Agle 14 din ki bikri (forecast)",
        )}
      </h3>
      {points.length > 1 ? (
        <>
          <LineBand
            hint={l(
              "The line is the units we expect to sell each day. The pale band is the likely range. Hover or tap a day to see the expected units. This is an estimate from past sales.",
              "लाइन हर दिन बिकने की अनुमानित इकाइयाँ है। हल्की पट्टी संभावित दायरा है। अनुमानित इकाइयाँ देखने के लिए किसी दिन पर माउस ले जाएँ या दबाएँ। यह पिछली बिक्री से अनुमान है।",
              "Line har din bikne ki anumaanit units hai. Halki patti sambhavit daayra hai. Anumaanit units dekhne ke liye kisi din par mouse le jao ya dabao. Yeh pichhli bikri se anumaan hai.",
            )}
            explain={() =>
              l(
                "Expected units sold on this day.",
                "इस दिन बिकने वाली अनुमानित इकाइयाँ।",
                "Is din bikne wali anumaanit units.",
              )
            }
            points={points}
            summary={summary}
            format={q1}
            axisFormat={(v) => num(v, 0)}
            height={220}
          />
          <Disclosure
            summary={l(
              "Day-by-day numbers",
              "दिन के हिसाब से आँकड़े",
              "Din ke hisaab se numbers",
            )}
            meta={l("14 days", "14 दिन", "14 din")}
          >
            <Table
              caption={l(
                `Forecast units per day for ${item.name}`,
                `${item.name} की रोज़ की इकाइयों का अनुमान`,
                `${item.name} ki roz ki unit ka anumaan`,
              )}
              dense
            >
              <thead>
                <tr>
                  <th scope="col">{l("Date", "तारीख़", "Tarikh")}</th>
                  <th scope="col" className="num">
                    {l("Forecast", "अनुमान", "Anumaan")}
                  </th>
                  <th scope="col" className="num">
                    {l("Low", "कम", "Kam")}
                  </th>
                  <th scope="col" className="num">
                    {l("High", "ज़्यादा", "Zyada")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {item.daily.map((d) => (
                  <tr key={d.date}>
                    <td
                      data-label={l("Date", "तारीख़", "Tarikh")}
                      data-primary=""
                    >
                      {dayKeyLabel(d.date)}
                    </td>
                    <td
                      className="num"
                      data-label={l("Forecast", "अनुमान", "Anumaan")}
                    >
                      {q1(d.yhat)}
                    </td>
                    <td className="num" data-label={l("Low", "कम", "Kam")}>
                      {q1(d.lo)}
                    </td>
                    <td
                      className="num"
                      data-label={l("High", "ज़्यादा", "Zyada")}
                    >
                      {q1(d.hi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Disclosure>
        </>
      ) : (
        <p className="stk-note">
          {l(
            "No forecast for this product yet.",
            "इस प्रोडक्ट का अनुमान अभी नहीं बना।",
            "Is product ka forecast abhi nahi bana.",
          )}
        </p>
      )}

      <h3 className="stk-h3">
        {l(
          "Asked for but not available",
          "माँगा पर नहीं मिला",
          "Jo maanga par nahi mila",
        )}
      </h3>
      {lost.length === 0 ? (
        <p className="stk-note">
          {l(
            "No lost sale noted for this product.",
            "इस प्रोडक्ट की कोई छूटी बिक्री नहीं लिखी।",
            "Is product ke liye koi lost sale nahi likhi.",
          )}
        </p>
      ) : (
        <>
          <p className="stk-note">
            {num(lost.length)} {l("times, total", "बार, कुल", "baar, kul")}{" "}
            {num(
              lost.reduce((s, x) => s + x.qty, 0),
              1,
            )}{" "}
            {l("pieces. Value", "पीस। क़ीमत", "piece. Value")}{" "}
            {rupees(lostTotal)}.
          </p>
          <LostTable
            rows={lost}
            caption={l(
              `Lost sales for ${item.name}, newest first`,
              `${item.name} की छूटी बिक्री, नई ऊपर`,
              `${item.name} ki lost sales, nayi upar`,
            )}
          />
        </>
      )}
    </section>
  );
}
