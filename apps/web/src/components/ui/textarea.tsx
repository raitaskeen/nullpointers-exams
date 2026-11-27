"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[var(--radius-control)] border border-control-border/70 bg-surface px-3 py-2.5 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
