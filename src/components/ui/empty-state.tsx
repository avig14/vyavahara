import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** what is empty, in the owner's words ("Abhi koi udhaar nahi") */
  title: string;
  /** why it matters, or what will show up here */
  description?: string;
  /** the one action that fills it, usually a Button */
  action?: ReactNode;
  /** brand picture from /brand, decorative */
  icon?: "rozmel" | "khata" | "stock" | "saathi" | "soundbox" | "settings" | "supplier" | "customers" | "reports" | "growth";
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="empty">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="empty-icon"
          src={`/brand/vyavahara-icon-${icon}-v1.svg`}
          alt=""
          width={56}
          height={56}
        />
      ) : null}
      <p className="empty-title">{title}</p>
      {description ? <p className="empty-text">{description}</p> : null}
      {action ? <div className="empty-act">{action}</div> : null}
    </div>
  );
}
