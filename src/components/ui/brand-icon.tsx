/* eslint-disable @next/next/no-img-element */
export type BrandIconName =
  "rozmel" | "khata" | "stock" | "saathi" | "soundbox" | "settings" | "supplier" | "customers" | "reports" | "growth";

/** Which brand picture stands for which page (assets/AGENT_GUIDE.md: rozmel, khata, stock, saathi, soundbox). */
export const PAGE_ICON: Record<string, BrandIconName> = {
  "/dashboard": "rozmel",
  "/dashboard/inventory": "stock",
  "/dashboard/vendors": "supplier",
  "/dashboard/khata": "khata",
  "/dashboard/customers": "customers",
  "/dashboard/reports": "reports",
  "/dashboard/growth": "growth",
  "/dashboard/settings": "settings",
  "/soundbox": "soundbox",
};

/** Decorative brand icon; the label next to it already says what it is. */
export function BrandIcon({
  name,
  size = 24,
  className,
}: {
  name: BrandIconName;
  size?: number;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={`/brand/vyavahara-icon-${name}-v1.svg`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
    />
  );
}
