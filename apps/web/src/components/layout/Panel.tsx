"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Bordered section with a title row: the one container every product screen uses. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-[var(--radius-card)] border border-border bg-card shadow-xs", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** A number that matters, with a label and an optional hint underneath. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <p className="text-[0.8125rem] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-[1.75rem] leading-none font-semibold tracking-[-0.02em] tabular-nums",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
          tone === "brand" && "text-primary",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const cls = cn("block rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-xs sm:p-5", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Underlined tab bar driven by links (state lives in the URL, so refresh and Back keep the tab). */
export function TabBar({ tabs, active, className }: { tabs: { id: string; label: ReactNode; href: string; badge?: ReactNode }[]; active: string; className?: string }) {
  return (
    <nav aria-label="Sections" className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <ul className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-2 px-3 text-sm font-medium transition-colors pointer-fine:min-h-10",
                  on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.badge}
                <span className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors", on ? "bg-primary" : "bg-transparent")} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Thin labelled progress bar. */
export function Meter({ value, max = 100, tone = "brand", className, label }: { value: number; max?: number; tone?: "brand" | "success" | "warning" | "danger" | "muted"; className?: string; label?: string }) {
  const w = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]",
          tone === "brand" && "bg-primary",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "danger" && "bg-danger",
          tone === "muted" && "bg-foreground/30",
        )}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

/** Small count bubble for tabs and nav. */
export function CountBadge({ n, tone = "muted" }: { n: number; tone?: "muted" | "brand" | "warning" }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-semibold tabular-nums",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "brand" && "bg-primary text-primary-foreground",
        tone === "warning" && "bg-warning-soft text-warning",
      )}
    >
      {n}
    </span>
  );
}
