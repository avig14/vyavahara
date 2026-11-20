import { EmptyState, Table } from "@/components/ui";
import { useL } from "@/lib/ui/lang";
import { rupees, num } from "@/lib/format";
import { instantLabel } from "@/lib/ui/stock-dates";
import type { LostRow } from "./types";

export interface LostTableProps {
  rows: readonly LostRow[];
  /** productId to name; when given the table adds a Product column */
  names?: ReadonlyMap<string, string>;
  caption: string;
}

/** Newest first: what the customer asked for, how many, what the sale was worth. */
export function LostTable({ rows, names, caption }: LostTableProps) {
  const l = useL();
  const sorted = [...rows].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return (
    <Table caption={caption} dense>
      <thead>
        <tr>
          <th scope="col">{l("Date", "तारीख़", "Tarikh")}</th>
          {names ? (
            <th scope="col">{l("Product", "प्रोडक्ट", "Product")}</th>
          ) : null}
          <th scope="col">
            {l("Customer said", "ग्राहक ने कहा", "Customer ne kaha")}
          </th>
          <th scope="col" className="num">
            {l("Qty", "मात्रा", "Qty")}
          </th>
          <th scope="col" className="num">
            {l("Value", "क़ीमत", "Value")}
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.id}>
            <td data-label={l("Date", "तारीख़", "Tarikh")} data-primary="">
              {instantLabel(r.createdAt)}
            </td>
            {names ? (
              <td data-label={l("Product", "प्रोडक्ट", "Product")}>
                {names.get(r.productId) ?? r.productId}
              </td>
            ) : null}
            <td
              data-label={l("Customer said", "ग्राहक ने कहा", "Customer ne kaha")}
            >
              {r.rawText ?? l("Not written", "लिखा नहीं", "Likha nahi")}
            </td>
            <td className="num" data-label={l("Qty", "मात्रा", "Qty")}>
              {num(r.qty, 1)}
            </td>
            <td className="num" data-label={l("Value", "क़ीमत", "Value")}>
              {rupees(r.estValuePaise)}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function LostEmpty() {
  const l = useL();
  return (
    <EmptyState
      title={l(
        "No lost sales yet",
        "अभी कोई छूटी बिक्री नहीं",
        "Abhi koi lost sale nahi",
      )}
      description={l(
        "When a customer asks for something that is out of stock, it is noted here.",
        "जब ग्राहक कोई चीज़ माँगे और स्टॉक में न हो, तो वह यहाँ लिखी जाती है।",
        "Jab customer koi cheez maange aur stock mein na ho, woh yahan likhi jaati hai.",
      )}
    />
  );
}
