import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** what is empty, in the owner's words ("Abhi koi udhaar nahi") */
  title: string;
  /** why it matters, or what will show up here */
  description?: string;
  /** the one action that fills it, usually a Button */
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {description ? <p className="empty-text">{description}</p> : null}
      {action ? <div className="empty-act">{action}</div> : null}
    </div>
  );
}
