"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CaretRight as ChevronRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.to && !last ? (
                <Link href={item.to} className="rounded-sm hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-foreground" : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Title + description + primary action row used at the top of every admin page. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-1.5">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
