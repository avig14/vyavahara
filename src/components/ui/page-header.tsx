"use client";

import type { ReactNode } from "react";
import { useLang } from "@/lib/ui/lang";
import { BrandIcon, type BrandIconName } from "./brand-icon";

const TITLE_ICON: Record<string, BrandIconName> = {
  Overview: "rozmel",
  Stock: "stock",
  Suppliers: "supplier",
  Khata: "khata",
  Customers: "customers",
  Reports: "reports",
  Growth: "growth",
};

/** Roman-script Hinglish name for each core noun; English is the title itself, Hindi is the `hindi` prop. */
const HINGLISH: Record<string, string> = {
  Overview: "Hisaab",
  Suppliers: "Supplier",
  Customers: "Grahak",
  Reports: "Report",
  Settings: "Setting",
};

export interface PageHeaderProps {
  /** a fact or a noun: "Khata", "₹42,000 udhaar baaki" */
  title: string;
  /** Devanagari sublabel for the core noun, shown beside the title */
  hindi?: string;
  description?: ReactNode;
  /** right side: filters, one primary Button at most */
  actions?: ReactNode;
}

export function PageHeader({
  title,
  hindi,
  description,
  actions,
}: PageHeaderProps) {
  const { lang } = useLang();
  const shown =
    lang === "hi" && hindi
      ? hindi
      : lang === "hing"
        ? (HINGLISH[title] ?? title)
        : title;
  return (
    <header className="ph">
      <div className="ph-main">
        <div className="ph-title">
          {TITLE_ICON[title] ? (
            <BrandIcon name={TITLE_ICON[title]} size={56} className="ph-icon" />
          ) : null}
          <h1 lang={lang === "hi" && hindi ? "hi" : undefined}>{shown}</h1>
        </div>
        {description ? <p className="ph-desc">{description}</p> : null}
      </div>
      {actions ? <div className="ph-actions">{actions}</div> : null}
    </header>
  );
}
