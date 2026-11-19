"use client";

import { useEffect, useRef } from "react";
import { LineBand } from "@/components/charts";
import { Badge, Button, Disclosure, Table } from "@/components/ui";
import { num, rupees } from "@/lib/format";
import { dayKeyLabel } from "@/lib/ui/stock-dates";
import { LostTable } from "./lost-sales";
import { daysText, STATUS_META } from "./status";
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
export function StockDetail({ item, data, onClose, takeFocus }: StockDetailProps) {
  const head = useRef<HTMLHeadingElement>(null);
  // a person picked this product: bring the reader to it (matters on a phone, where it sits above the table)
  useEffect(() => {
    if (takeFocus) head.current?.focus();
    // only when the product changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.productId]);

  const meta = STATUS_META[item.status];
  const rec = data.recommendations.find((r) => r.id.endsWith(`:${item.productId}`) && !r.id.startsWith("ADD_LOST"));
  const lost = data.lostDemand.rows.filter((l) => l.productId === item.productId);
  const lostTotal = lost.reduce((s, l) => s + l.estValuePaise, 0);
  const orderNow = item.status === "stockout" || item.status === "reorder";
  const points = item.daily.map((d) => ({ label: dayKeyLabel(d.date), forecast: d.yhat, low: d.lo, high: d.hi }));
  const first = item.daily[0];
  const last = item.daily[item.daily.length - 1];
  const total = item.daily.reduce((s, d) => s + d.yhat, 0);
  const summary = first && last ? `Forecast of daily units sold for ${item.name}, ${dayKeyLabel(first.date)} to ${dayKeyLabel(last.date)}: about ${q1(total)} units in all, from ${q1(first.yhat)} a day at the start to ${q1(last.yhat)} a day at the end, with a likely range around each day.` : `No forecast for ${item.name}.`;

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
          Band karo
        </Button>
      </div>

      {rec ? <p className="stk-rec">{rec.title}</p> : null}

      {orderNow ? (
        <p className="stk-order">
          {item.suggestedOrderQty > 0 ? (
            <>
              <span className="figure stk-big">{num(item.suggestedOrderQty)}</span> <span>mangwao. Delivery mein {num(item.leadTimeDays)} din lagte hain.</span>
            </>
          ) : (
            <span>Order ki quantity abhi nahi bani.</span>
          )}
        </p>
      ) : null}

      <dl className="facts">
        <div>
          <dt>On hand</dt>
          <dd>{q1(item.stock)}</dd>
        </div>
        <div>
          <dt>Aaj bika</dt>
          <dd>{q1(item.soldToday)}</dd>
        </div>
        <div>
          <dt>Days of cover</dt>
          <dd>{daysText(item.coverDays)}</dd>
        </div>
        <div>
          <dt>Khatam hone mein</dt>
          <dd>
            {daysText(item.daysToStockout)}
            <small>
              {daysText(item.daysToStockoutRange[0])} se {daysText(item.daysToStockoutRange[1])}
            </small>
          </dd>
        </div>
        <div>
          <dt>Reorder point</dt>
          <dd>{q1(item.reorderPoint)}</dd>
        </div>
        <div>
          <dt>Safety stock</dt>
          <dd>{q1(item.safetyStock)}</dd>
        </div>
        <div>
          <dt>Delivery time</dt>
          <dd>{num(item.leadTimeDays)} din</dd>
        </div>
      </dl>

      <h3 className="stk-h3">Agle 14 din ki bikri (forecast)</h3>
      {points.length > 1 ? (
        <>
          <LineBand points={points} summary={summary} format={q1} axisFormat={(v) => num(v, 0)} height={220} />
          <Disclosure summary="Din ke hisaab se numbers" meta="14 din">
            <Table caption={`Forecast units per day for ${item.name}`} dense>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col" className="num">
                    Forecast
                  </th>
                  <th scope="col" className="num">
                    Low
                  </th>
                  <th scope="col" className="num">
                    High
                  </th>
                </tr>
              </thead>
              <tbody>
                {item.daily.map((d) => (
                  <tr key={d.date}>
                    <td data-label="Date" data-primary="">
                      {dayKeyLabel(d.date)}
                    </td>
                    <td className="num" data-label="Forecast">
                      {q1(d.yhat)}
                    </td>
                    <td className="num" data-label="Low">
                      {q1(d.lo)}
                    </td>
                    <td className="num" data-label="High">
                      {q1(d.hi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Disclosure>
        </>
      ) : (
        <p className="stk-note">Is product ka forecast abhi nahi bana.</p>
      )}

      <h3 className="stk-h3">Jo maanga par nahi mila</h3>
      {lost.length === 0 ? (
        <p className="stk-note">Is product ke liye koi lost sale nahi likhi.</p>
      ) : (
        <>
          <p className="stk-note">
            {num(lost.length)} baar, kul {num(lost.reduce((s, l) => s + l.qty, 0), 1)} piece. Value {rupees(lostTotal)}.
          </p>
          <LostTable rows={lost} caption={`Lost sales for ${item.name}, newest first`} />
        </>
      )}
    </section>
  );
}
