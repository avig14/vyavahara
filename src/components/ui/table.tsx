import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { SkeletonRows } from "./skeleton";

export interface TableProps {
  /** names the table for screen readers; shown above it when `captionVisible` */
  caption: string;
  captionVisible?: boolean;
  /** header row stays under the top bar while the page scrolls */
  sticky?: boolean;
  dense?: boolean;
  /** under 40rem each row becomes a labelled block; custom `<td>`s then need `data-label` */
  restack?: boolean;
  className?: string;
  children: ReactNode;
}

/** Ledger table shell: horizontal rules only, no outer border. Put `thead`, `tbody`, `tfoot` inside. Number cells: `className="num"`. */
export function Table({ caption, captionVisible = false, sticky, dense, restack = true, className, children }: TableProps) {
  return (
    <div className="tbl-wrap" data-sticky={sticky ? "" : undefined}>
      <table className={cx("tbl", className)} data-restack={restack ? "" : undefined} data-dense={dense ? "" : undefined}>
        <caption className={captionVisible ? undefined : "visually-hidden"}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export interface Column<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row, index: number) => ReactNode;
  /** right-aligned, tabular figures (money, quantities) */
  num?: boolean;
  /** names the row: becomes the select button and, on a phone, the block title. Defaults to the first column. */
  primary?: boolean;
  /** phone label when `header` is not plain text */
  label?: string;
  /** phone: full width with no label (row actions) */
  nolabel?: boolean;
  /** total cell for a `<tfoot>` row */
  footer?: ReactNode;
  width?: string;
}

export interface DataTableProps<Row> {
  caption: string;
  captionVisible?: boolean;
  columns: readonly Column<Row>[];
  /** `undefined` means not loaded yet */
  rows: readonly Row[] | undefined;
  rowKey: (row: Row) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** shown when loaded and empty; pass an EmptyState */
  empty?: ReactNode;
  sticky?: boolean;
  dense?: boolean;
  /** highlighted row (state kept in the URL by the caller) */
  selectedKey?: string | null;
  /** makes rows selectable: click the row, or press the button in its primary cell */
  onSelect?: (key: string) => void;
  skeletonRows?: number;
}

function headerText(c: Column<never>): string {
  return c.label ?? (typeof c.header === "string" ? c.header : c.key);
}

/** The four states of a table in one component: loading skeleton, error with retry, empty, full. */
export function DataTable<Row>({
  caption,
  captionVisible,
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  sticky,
  dense,
  selectedKey,
  onSelect,
  skeletonRows = 6,
}: DataTableProps<Row>) {
  if (error) return <ErrorState title="Could not load this table" error={error} onRetry={onRetry} retrying={loading} />;
  if (!rows) return loading ? <SkeletonRows rows={skeletonRows} cols={Math.min(columns.length, 5)} /> : null;
  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;

  const primaryKey = (columns.find((c) => c.primary) ?? columns[0]).key;
  const hasFooter = columns.some((c) => c.footer !== undefined);

  return (
    <Table caption={caption} captionVisible={captionVisible} sticky={sticky} dense={dense}>
      <colgroup>
        {columns.map((c) => (
          <col key={c.key} style={c.width ? { width: c.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col" className={c.num ? "num" : undefined}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const key = rowKey(row);
          const selected = selectedKey === key;
          return (
            <tr key={key} data-selected={selected ? "" : undefined} data-selectable={onSelect ? "" : undefined} onClick={onSelect ? () => onSelect(key) : undefined}>
              {columns.map((c) => {
                const content = c.cell(row, i);
                const isPrimary = c.key === primaryKey;
                return (
                  <td
                    key={c.key}
                    className={c.num ? "num" : undefined}
                    data-label={headerText(c)}
                    data-primary={isPrimary ? "" : undefined}
                    data-nolabel={c.nolabel ? "" : undefined}
                  >
                    {isPrimary && onSelect ? (
                      <button type="button" className="tbl-rowbtn" aria-current={selected ? "true" : undefined} onClick={(e) => { e.stopPropagation(); onSelect(key); }}>
                        {content}
                      </button>
                    ) : (
                      content
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
      {hasFooter ? (
        <tfoot>
          <tr>
            {columns.map((c) => (
              <td key={c.key} className={c.num ? "num" : undefined} data-label={headerText(c)} data-nolabel={c.footer === undefined ? "" : undefined}>
                {c.footer}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </Table>
  );
}
