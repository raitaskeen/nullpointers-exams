import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site-config";

/**
 * Brand mark: a timer ring that is three-quarters complete, closed by a tick - "on time, verified".
 * Authored SVG in the brand color, flat.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
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
