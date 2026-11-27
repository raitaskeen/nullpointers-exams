import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site-config";

/**
 * Brand mark: a timer ring that is three-quarters complete, closed by a tick - "on time, verified".
 * Authored SVG in the brand color, with a soft top sheen so it sits with the glass controls.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id="lm-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(from var(--primary) calc(l + 0.08) c h)" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9.5" fill="url(#lm-fill)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="none" stroke="oklch(1 0 0 / 0.22)" />
      <path d="M16 7.5a8.5 8.5 0 1 1-8.5 8.5" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12.2 16.3l2.6 2.6 5-5.4" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-[-0.03em]", className)}>
      <LogoMark />
      {!compact && <span className="text-[1.125rem]">{siteConfig.productName}</span>}
    </span>
  );
}
