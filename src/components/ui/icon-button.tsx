import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

export interface IconButtonProps extends Omit<ComponentProps<"button">, "children" | "aria-label"> {
  /** accessible name, also the native tooltip */
  label: string;
  variant?: "quiet" | "secondary";
  children: ReactNode;
}

export function IconButton({ label, variant = "quiet", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={cx("ic-btn", variant === "secondary" && "ic-btn-secondary", className)} {...rest}>
      {children}
    </button>
  );
}
