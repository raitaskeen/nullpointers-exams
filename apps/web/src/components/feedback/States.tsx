"use client";

import type { ComponentType, ReactNode } from "react";
import { WarningCircle as CircleAlert, Tray as Inbox, LockSimple as Lock, ArrowClockwise as RefreshCw } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The four non-happy-path states every data view needs (kit section 7: empty, loading, error, no-permission).
 * Use these instead of one-off markup so every screen handles them the same way.
 */

function StateFrame({
  icon: Icon,
  iconClassName,
  title,
  description,
  action,
  className,
}: {
  icon: ComponentType<{ className?: string; weight?: "duotone" }>;
  iconClassName?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-border bg-card px-6 py-14 text-center shadow-xs",
        className
      )}
    >
      <div className={cn("flex size-12 items-center justify-center rounded-2xl bg-muted", iconClassName)}>
        <Icon className="size-6" weight="duotone" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  description,
  action,
  className,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <StateFrame
      icon={Inbox}
      iconClassName="text-muted-foreground"
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Check your connection and try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <StateFrame
      icon={CircleAlert}
      iconClassName="bg-danger-soft text-danger"
      title={title}
      description={description}
      className={className}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        )
      }
    />
  );
}

export function NoPermissionState({
  title = "You don't have access to this",
  description = "Ask an administrator to grant you the required role.",
  className,
}: {
  title?: string;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <StateFrame
      icon={Lock}
      iconClassName="bg-warning-soft text-warning"
      title={title}
      description={description}
      className={className}
    />
  );
}

/** Skeleton rows for list/table loading. Keeps layout stable instead of a blank flash. */
export function LoadingRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
