"use client";

import * as React from "react";
import { CaretUpDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Styled native <select>: works with react-hook-form's register(), is keyboard/screen-reader friendly,
 * and opens the OS picker on phones (the best mobile UX for a short list).
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full", className)} data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className="h-11 w-full cursor-pointer appearance-none rounded-[var(--radius-control)] border border-control-border/70 bg-surface ps-3 pe-9 text-base text-foreground shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:h-10 sm:text-sm"
        {...props}
      >
        {children}
      </select>
      <CaretUpDown
        aria-hidden="true"
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
