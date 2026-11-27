"use client";

import type { ComponentType, ReactNode } from "react";
import { WarningCircle as CircleAlert, CheckCircle as CircleCheck, CircleDashed, Info, Warning as TriangleAlert } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneStyles: Record<StatusTone, { className: string; Icon: ComponentType<{ className?: string }> }> = {
  success: { className: "bg-success-soft text-success", Icon: CircleCheck },
  warning: { className: "bg-warning-soft text-warning", Icon: TriangleAlert },
  danger: { className: "bg-danger-soft text-danger", Icon: CircleAlert },
  info: { className: "bg-secondary text-secondary-foreground", Icon: Info },
  neutral: { className: "bg-muted text-muted-foreground", Icon: CircleDashed },
};

/**
 * Status label that never relies on color alone (kit section 3): every tone pairs an icon with text.
 * Text/background pairs are the kit's contrast-checked status combinations.
 */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  const { className: toneClassName, Icon } = toneStyles[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        toneClassName,
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}
