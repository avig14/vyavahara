import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** a fact or a noun: "Khata", "₹42,000 udhaar baaki" */
  title: string;
  /** Devanagari sublabel for the core noun, shown beside the title */
  hindi?: string;
  description?: ReactNode;
  /** right side: filters, one primary Button at most */
  actions?: ReactNode;
}

export function PageHeader({ title, hindi, description, actions }: PageHeaderProps) {
  return (
    <header className="ph">
      <div className="ph-main">
        <div className="ph-title">
          <h1>{title}</h1>
          {hindi ? (
            <span className="ph-hi deva" lang="hi">
              {hindi}
            </span>
          ) : null}
        </div>
        {description ? <p className="ph-desc">{description}</p> : null}
      </div>
      {actions ? <div className="ph-actions">{actions}</div> : null}
    </header>
  );
}
