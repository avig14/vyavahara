export interface NavItem {
  href: string;
  label: string;
  /** Devanagari noun the owner already says */
  hindi: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Overview", hindi: "हिसाब" },
  { href: "/dashboard/inventory", label: "Stock", hindi: "स्टॉक" },
  { href: "/dashboard/vendors", label: "Suppliers", hindi: "सप्लायर" },
  { href: "/dashboard/khata", label: "Khata", hindi: "खाता" },
  { href: "/dashboard/customers", label: "Customers", hindi: "ग्राहक" },
  { href: "/dashboard/reports", label: "Reports", hindi: "रिपोर्ट" },
  { href: "/dashboard/growth", label: "Growth", hindi: "ग्रोथ" },
  { href: "/dashboard/settings", label: "Settings", hindi: "सेटिंग" },
];

/** Overview is only current on its own path; the others also own their sub-paths. */
export function isCurrent(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
