"use client";

import {
  Badge,
  Button,
  ChevronDownIcon,
  DataTable,
  EmptyState,
  type Column,
} from "@/components/ui";
import { num } from "@/lib/format";
import { coverLabel, statusMeta } from "./status";
import { useL } from "@/lib/ui/lang";
import type { ItemForecast } from "./types";
import type { SortDir } from "./stock-filters";

export interface StockTableProps {
  rows: readonly ItemForecast[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  selected: string | null;
  onSelect: (productId: string) => void;
  sort: SortDir;
  onSort: (v: SortDir) => void;
  /** a filter or search is active: an empty list then means "no match", not "no stock" */
  filtered: boolean;
  onClear: () => void;
}

export function StockTable({
  rows,
  loading,
  error,
  onRetry,
  selected,
  onSelect,
  sort,
  onSort,
  filtered,
  onClear,
}: StockTableProps) {
  const l = useL();
  const meta = statusMeta(l);
  const next: SortDir = sort === "asc" ? "desc" : "asc";
  const lowest = l("lowest first", "सबसे कम पहले", "sabse kam pehle");
  const highest = l("highest first", "सबसे ज़्यादा पहले", "sabse zyada pehle");
  const columns: Column<ItemForecast>[] = [
    {
      key: "name",
      header: l("Product", "प्रोडक्ट", "Product"),
      primary: true,
      cell: (r) => (
        <>
          {r.name}
          <span className="stk-sub">{r.category}</span>
        </>
      ),
    },
    {
      key: "stock",
      header: l("On hand", "स्टॉक में", "Stock mein"),
      num: true,
      cell: (r) => num(r.stock, 1),
    },
    {
      key: "cover",
      header: (
        <button
          type="button"
          className="stk-sortbtn"
          data-dir={sort}
          aria-label={`${l("Days of cover", "बचे दिन", "Bache din")}, ${sort === "asc" ? lowest : highest}. ${l("Press for", "बदलने के लिए दबाएँ:", "Badalne ke liye dabao:")} ${next === "asc" ? lowest : highest}.`}
          onClick={() => onSort(next)}
        >
          {l(l("Days of cover", "बचे दिन", "Bache din"), "बचे दिन", "Bache din")}
          <ChevronDownIcon size={14} />
        </button>
      ),
      label: "Days of cover",
      num: true,
      cell: (r) => coverLabel(r.coverDays, l),
    },
    {
      key: "status",
      header: l("Status", "स्थिति", "Status"),
      cell: (r) => (
        <Badge tone={meta[r.status].tone}>{meta[r.status].label}</Badge>
      ),
    },
  ];

  return (
    <div className="stk-table">
      <DataTable
        caption={`${l("Stock, sorted by days of cover", "स्टॉक, बचे दिनों के हिसाब से", "Stock, bache dinon ke hisaab se")} ${sort === "asc" ? lowest : highest}`}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.productId}
        loading={loading}
        error={error}
        onRetry={onRetry}
        selectedKey={selected}
        onSelect={onSelect}
        skeletonRows={9}
        empty={
          filtered ? (
            <EmptyState
              title={l("Nothing found", "कुछ नहीं मिला", "Kuch nahi mila")}
              description={l(
                "No product matches this search or status. Clear the filter and look again.",
                "इस खोज या स्थिति में कोई प्रोडक्ट नहीं है। फ़िल्टर हटाकर देखें।",
                "Is search ya status mein koi product nahi hai. Filter hata kar dekho.",
              )}
              action={
                <Button onClick={onClear}>
                  {l("Clear filter", "फ़िल्टर हटाएँ", "Filter hatao")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={l(
                "No products yet",
                "अभी कोई प्रोडक्ट नहीं",
                "Abhi koi product nahi",
              )}
              description={l(
                "The stock list is empty. Products will show here once added.",
                "स्टॉक सूची ख़ाली है। प्रोडक्ट जुड़ने पर यहाँ दिखेंगे।",
                "Stock list khaali hai. Product jodne ke baad yahan dikhega.",
              )}
            />
          )
        }
      />
    </div>
  );
}
