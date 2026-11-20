"use client";

import { Badge, Table } from "@/components/ui";
import { rupees } from "@/lib/format";
import { useT } from "@/lib/ui/lang";

interface Line {
  time: string;
  items: string;
  method: "UPI" | "Cash";
  paise: number;
}

/** Plainly sample lines, oldest first. The running total is added up here, never typed in. */
const SAMPLE: readonly Line[] = [
  { time: "9:05", items: "Doodh, bread", method: "UPI", paise: 10_000 },
  { time: "9:40", items: "Atta 5 kg", method: "UPI", paise: 25_000 },
  { time: "10:15", items: "Chai patti, sugar", method: "Cash", paise: 20_000 },
  { time: "11:02", items: "Maggi, 4 packs", method: "UPI", paise: 6_000 },
  { time: "11:30", items: "Paani, 2 bottles", method: "UPI", paise: 4_000 },
];

function withTotals(lines: readonly Line[]) {
  let run = 0;
  return lines.map((l) => ({ ...l, totalPaise: (run += l.paise) }));
}

/** The rozmel as a ruled day-book, newest line on top, labelled as an example. */
export function RozmelExample() {
  const t = useT();
  const rows = withTotals(SAMPLE).reverse();
  return (
    <figure className="lp-roz">
      <figcaption className="lp-roz-cap">
        <Badge tone="info">{t("ex.badge")}</Badge>
        <span>{t("ex.note")}</span>
      </figcaption>
      <Table caption={t("ex.caption")}>
        <thead>
          <tr>
            <th scope="col">{t("ex.time")}</th>
            <th scope="col">{t("ex.items")}</th>
            <th scope="col">{t("ex.by")}</th>
            <th scope="col" className="num">
              {t("ex.amount")}
            </th>
            <th scope="col" className="num">
              {t("ex.total")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.time}>
              <td data-label={t("ex.time")} className="num">
                {r.time}
              </td>
              <td data-label={t("ex.items")}>{r.items}</td>
              <td data-label={t("ex.by")}>{r.method}</td>
              <td data-label={t("ex.amount")} className="num">
                {rupees(r.paise)}
              </td>
              <td data-label={t("ex.total")} className="num tot">
                {rupees(r.totalPaise)}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </figure>
  );
}
