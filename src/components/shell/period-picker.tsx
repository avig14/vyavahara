"use client";

import { Input, Select } from "@/components/ui/field";
import {
  PERIOD_OPTIONS,
  defaultCustomRange,
  periodLabelFor,
  todayKey,
  usePeriod,
} from "@/lib/ui/period";
import { useL, useLang } from "@/lib/ui/lang";
import { isPeriodName } from "@/lib/time";

/** Period in the URL: a select, plus two date boxes when it is a custom range. */
export function PeriodPicker() {
  const { name, from, to, setPeriod, setCustom } = usePeriod();
  const today = todayKey();
  const { lang } = useLang();
  const l = useL();
  const options = PERIOD_OPTIONS.map((p) => ({
    value: p.name,
    label: periodLabelFor(p.name, lang),
  }));

  return (
    <div className="period" role="group" aria-label={l("Period", "अवधि", "Period")}>
      <Select
        aria-label={l("Period", "अवधि", "Period")}
        value={name}
        options={options}
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
            aria-label={l("From date", "शुरू की तारीख़", "Shuru ki tarikh")}
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
            aria-label={l("To date", "आख़िरी तारीख़", "Aakhri tarikh")}
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
