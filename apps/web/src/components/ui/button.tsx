"use client";

import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Touch-first sizing: controls are 44px tall on touch screens (WCAG target size) and tighten to 36px
 * where there's a fine pointer. Primary carries a brand shadow + inner highlight; every variant answers
 * hover and press.
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-transparent bg-clip-padding text-sm font-medium tracking-[-0.005em] whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,box-shadow,transform,translate] duration-200 ease-[var(--ease-out)] focus-visible:ring-[3px] focus-visible:ring-ring/35 active:not-aria-[haspopup]:scale-[0.97] active:not-aria-[haspopup]:duration-75 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.125rem]",
  {
    variants: {
      variant: {
        default:
          "border-[oklch(0.3_var(--brand-c)_var(--brand-h)/0.35)] bg-[linear-gradient(180deg,oklch(from_var(--primary)_calc(l+0.06)_c_h),var(--primary))] text-primary-foreground shadow-brand hover:-translate-y-px hover:shadow-[0_1px_2px_oklch(0.3_var(--brand-c)_var(--brand-h)/0.25),0_10px_22px_-8px_oklch(0.45_var(--brand-c)_var(--brand-h)/0.55)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:shadow-[inset_0_1px_0_oklch(1_0_0/0.28)] after:pointer-events-none after:absolute after:inset-x-[10%] after:top-0 after:h-1/2 after:rounded-b-[50%] after:bg-[linear-gradient(180deg,oklch(1_0_0/0.16),transparent)]",
        outline:
          "border-[var(--glass-border)] bg-[var(--glass)] text-foreground shadow-[var(--glass-edge),var(--glass-shadow)] backdrop-blur-xl backdrop-saturate-150 hover:bg-[var(--glass-strong)] hover:-translate-y-px aria-expanded:bg-[var(--glass-strong)]",
        glass:
          "border-[var(--glass-border)] bg-[var(--glass)] text-foreground shadow-[var(--glass-edge),var(--glass-shadow)] backdrop-blur-xl backdrop-saturate-150 hover:bg-[var(--glass-strong)] hover:-translate-y-px",
        secondary: "bg-brand-soft text-brand-ink hover:bg-[color-mix(in_oklch,var(--brand-soft),var(--foreground)_6%)]",
        ghost: "text-foreground-soft hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-[color-mix(in_oklch,var(--destructive),black_10%)]",
        "destructive-soft": "bg-danger-soft text-danger hover:bg-[color-mix(in_oklch,var(--danger-soft),var(--danger)_10%)]",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 pointer-fine:h-9 pointer-fine:px-3.5",
        sm: "h-10 gap-1.5 px-3 text-[0.8125rem] pointer-fine:h-8 pointer-fine:px-2.5 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 px-5 text-[0.9375rem] pointer-fine:h-11",
        xs: "h-8 gap-1 rounded-md px-2 text-xs pointer-fine:h-7 [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-11 pointer-fine:size-9",
        "icon-sm": "size-10 pointer-fine:size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-8 rounded-md pointer-fine:size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-12 pointer-fine:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>

function Button({ className, variant = "default", size = "default", nativeButton, render, children, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className: typeof className === "string" ? className : undefined }))

  // Rendered as a link (<Link>/<a>): keep link semantics. Base UI's Button would add role="button",
  // which makes screen readers announce navigation as an action.
  if (React.isValidElement<{ className?: string; children?: React.ReactNode }>(render)) {
    const el = render as React.ReactElement<Record<string, unknown>>
    const { disabled: _d, focusableWhenDisabled: _f, ...rest } = props as Record<string, unknown>
    return React.cloneElement(el, {
      ...rest,
      "data-slot": "button",
      className: cn(classes, el.props.className as string | undefined),
      children: children ?? (el.props.children as React.ReactNode),
    })
  }

  return (
    <ButtonPrimitive data-slot="button" nativeButton={nativeButton ?? true} className={classes} {...props}>
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
