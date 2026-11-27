"use client";

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

/** 44px on touch, 40px with a mouse. 16px text on phones so iOS never zooms the page on focus. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-control-border/70 bg-surface px-3 text-base text-foreground shadow-xs outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/80 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:h-10 sm:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
