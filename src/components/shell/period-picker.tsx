"use client";

import { Input, Select } from "@/components/ui/field";
import { PERIOD_OPTIONS, defaultCustomRange, todayKey, usePeriod } from "@/lib/ui/period";
import { isPeriodName } from "@/lib/time";

const OPTIONS = PERIOD_OPTIONS.map((p) => ({ value: p.name, label: p.label }));

/** Period in the URL: a select, plus two date boxes when it is a custom range. */
export function PeriodPicker() {
  const { name, from, to, setPeriod, setCustom } = usePeriod();
  const today = todayKey();

  return (
    <div className="period" role="group" aria-label="Period">
      <Select
        aria-label="Period"
        value={name}
        options={OPTIONS}
        onChange={(e) => {
          const v = e.target.value;
          if (!isPeriodName(v)) return;
          if (v === "custom") {
            const r = defaultCustomRange();
            setCustom(r.from, r.to);
          } else setPeriod(v);
        }}
      />
      {name === "custom" && from && to ? (
        <>
          <Input
            type="date"
            aria-label="From date"
            value={from}
            max={to}
            onChange={(e) => {
              if (e.target.value) setCustom(e.target.value, to);
            }}
          />
          <span className="period-sep" aria-hidden="true">
            to
          </span>
          <Input
            type="date"
            aria-label="To date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => {
              if (e.target.value) setCustom(from, e.target.value);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
