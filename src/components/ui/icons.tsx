import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Base({ size = 18, ...p }: IconProps & { d: string }) {
  const { d, ...rest } = p;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={d} />
    </svg>
  );
}

export const MenuIcon = (p: IconProps) => <Base d="M4 7h16M4 12h16M4 17h16" {...p} />;
export const CloseIcon = (p: IconProps) => <Base d="M6 6l12 12M18 6L6 18" {...p} />;
export const ChevronDownIcon = (p: IconProps) => <Base d="M6 9l6 6 6-6" {...p} />;
export const CheckIcon = (p: IconProps) => <Base d="M5 12.5l4.5 4.5L19 7.5" {...p} />;
export const RefreshIcon = (p: IconProps) => <Base d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6" {...p} />;
export const SendIcon = (p: IconProps) => <Base d="M4 12l16-8-6 16-3-7-7-1z" {...p} />;

export function SpinnerIcon({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true" focusable="false" className={`spin keep-motion${className ? ` ${className}` : ""}`} {...rest}>
      <path d="M12 3a9 9 0 019 9" />
      <circle cx="12" cy="12" r="9" opacity="0.25" />
    </svg>
  );
}
