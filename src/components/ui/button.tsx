import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { SpinnerIcon } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export interface ButtonProps extends Omit<ComponentProps<"button">, "children"> {
  /** primary is the cyan fill: one per page (a dialog counts as its own page) */
  variant?: ButtonVariant;
  /** keeps the width, hides the label behind a spinner, sets aria-busy, ignores clicks */
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
  children: ReactNode;
}

export function Button({ variant = "secondary", loading = false, icon, block, className, children, type = "button", onClick, disabled, ...rest }: ButtonProps) {
  const inert = disabled || loading;
  return (
    <button
      type={type}
      className={cx("btn", `btn-${variant}`, block && "btn-block", className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={inert ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      <span className="btn-label">
        {icon}
        {children}
      </span>
      {loading ? <SpinnerIcon className="btn-spin" /> : null}
    </button>
  );
}

export interface LinkButtonClassOptions {
  variant?: ButtonVariant;
  block?: boolean;
}

/** Class string for a `next/link` that must look like a Button: `<Link className={buttonClass()} href=…>`. */
export function buttonClass({ variant = "secondary", block }: LinkButtonClassOptions = {}): string {
  return cx("btn", `btn-${variant}`, block && "btn-block");
}
