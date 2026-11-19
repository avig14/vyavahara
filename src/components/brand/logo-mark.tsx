import Image from "next/image";

/**
 * The Vyavahāra logo, exactly as supplied (व्य in the split ring). It is a raster render of the original SVG, never redrawn,
 * so it is shown unoptimized: no re-encoding, no colour shift. `size` is the CSS pixel box; the file is 128px, sharp up to 64px at 2x.
 * Decorative (`alt=""`): the name is always written next to it.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src="/brand/vyavahara-logo-128.png" alt="" width={size} height={size} unoptimized className={className ? `logo-mark ${className}` : "logo-mark"} />;
}
