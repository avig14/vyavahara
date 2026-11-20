"use client";

import { Button } from "@/components/ui/button";
import { num } from "@/lib/format";
import { useActionState } from "@/lib/ui/action-state";
import { useL } from "@/lib/ui/lang";
import type { ItemForecast } from "./types";

const HORIZON = 14;

/**
 * Stock timeline: today on the left, 14 days on the right. The navy bar is the estimated stock left, shrinking to the expected
 * stockout; the cyan tick is the latest day an order must be placed for delivery to land in time. An estimate, with its range.
 */
export function StockRunway({ item }: { item: ItemForecast }) {
  const l = useL();
  const acts = useActionState();
  const days = Math.min(HORIZON, Math.max(0, item.daysToStockout));
  const [lo, hi] = item.daysToStockoutRange;
  const orderBy = Math.max(0, item.daysToStockout - item.leadTimeDays);
  const pct = (d: number) => `${(Math.min(HORIZON, d) / HORIZON) * 100}%`;
  const recId = `REORDER:${item.productId}`;
  const ordered = acts.hidden(recId);
  const need = item.status === "stockout" || item.status === "reorder";
  const msg = l(
    `Hello, I need ${num(item.suggestedOrderQty)} of ${item.name}. When can you deliver?`,
    `नमस्ते, मुझे ${item.name} ${num(item.suggestedOrderQty)} चाहिए। कब तक भेज सकते हैं?`,
    `Namaste, mujhe ${item.name} ${num(item.suggestedOrderQty)} chahiye. Kab tak bhej sakte hain?`,
  );

  return (
    <section
      className="rw"
      aria-label={l("Stock timeline", "स्टॉक की समय-रेखा", "Stock timeline")}
    >
      <div
        className="rw-track"
        role="img"
        aria-label={l(
          `Stock may last about ${num(item.daysToStockout, 1)} days. Order within ${num(orderBy, 1)} days.`,
          `स्टॉक करीब ${num(item.daysToStockout, 1)} दिन चलेगा। ${num(orderBy, 1)} दिन में ऑर्डर करें।`,
          `Stock lagbhag ${num(item.daysToStockout, 1)} din chalega. ${num(orderBy, 1)} din mein order karo.`,
        )}
      >
        <span
          className="rw-range"
          style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }}
        />
        <span className="rw-bar" style={{ width: pct(days) }} />
        {need ? (
          <span className="rw-tick" style={{ left: pct(orderBy) }} />
        ) : null}
      </div>
      <div className="rw-scale" aria-hidden="true">
        <span>{l("Today", "आज", "Aaj")}</span>
        <span>7</span>
        <span>
          {HORIZON} {l("days", "दिन", "din")}
        </span>
      </div>
      <p className="rw-note">
        {item.stock <= 0
          ? l("Out of stock now.", "अभी स्टॉक ख़त्म है।", "Abhi stock khatam hai.")
          : l(
              `Likely to run out in about ${num(item.daysToStockout, 1)} days (could be ${num(lo, 1)} to ${num(hi, 1)}). Estimate from past sales, not a promise.`,
              `करीब ${num(item.daysToStockout, 1)} दिन में ख़त्म हो सकता है (${num(lo, 1)} से ${num(hi, 1)} दिन के बीच)। पिछली बिक्री से अनुमान, गारंटी नहीं।`,
              `Lagbhag ${num(item.daysToStockout, 1)} din mein khatam ho sakta hai (${num(lo, 1)} se ${num(hi, 1)} din ke beech). Pichhli bikri se anumaan, guarantee nahi.`,
            )}
        {need && item.stock > 0
          ? " " +
            l(
              `Order within ${num(orderBy, 1)} days; delivery takes ${num(item.leadTimeDays)}.`,
              `${num(orderBy, 1)} दिन में ऑर्डर करें; डिलीवरी में ${num(item.leadTimeDays)} दिन लगते हैं।`,
              `${num(orderBy, 1)} din mein order karo; delivery mein ${num(item.leadTimeDays)} din lagte hain.`,
            )
          : ""}
      </p>
      {need && item.suggestedOrderQty > 0 ? (
        <div className="rw-acts">
          <a
            className="btn btn-primary"
            href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
            target="_blank"
            rel="noreferrer"
          >
            {l(
              "Message supplier on WhatsApp",
              "सप्लायर को WhatsApp करें",
              "Supplier ko WhatsApp karo",
            )}
          </a>
          {ordered ? (
            <Button variant="secondary" onClick={() => acts.undo(recId)}>
              {l(
                "Marked as ordered. Undo",
                "ऑर्डर हो गया। वापस लाएँ",
                "Order ho gaya. Wapas lao",
              )}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => acts.markDone(recId)}>
              {l("Already ordered", "ऑर्डर दे चुका हूँ", "Order de chuka hoon")}
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
