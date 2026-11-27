import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site-config";

/**
 * Brand mark: two offset strokes forming a pointer-like chevron inside a rounded tile, drawn in the
 * brand color. Authored SVG (not an icon-library glyph or gradient square) so it reads as a real mark.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M11 9.5 L19.5 16 L11 22.5" fill="none" stroke="var(--primary-foreground)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22.5" cy="22" r="2" fill="var(--primary-foreground)" opacity="0.7" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-[-0.02em]", className)}>
      <LogoMark />
      {!compact && <span className="text-[1.0625rem]">{siteConfig.productName}</span>}
    </span>
  );
}
