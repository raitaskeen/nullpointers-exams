"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Side sheet on Base UI's Dialog (focus trap, Esc, scroll lock, return focus all handled). Slides from the
 * inline-end edge (right in LTR, left in RTL); full screen on phones.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(0.2_0.02_262/0.3)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 end-0 z-50 flex w-full flex-col bg-popover shadow-lg outline-none transition-[transform,opacity] duration-300 ease-[var(--ease-out)] sm:w-[min(30rem,100%)] sm:border-s sm:border-border-strong",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            "data-[starting-style]:translate-x-8 data-[starting-style]:opacity-0 data-[ending-style]:translate-x-8 data-[ending-style]:opacity-0 rtl:data-[starting-style]:-translate-x-8 rtl:data-[ending-style]:-translate-x-8",
            className,
          )}
        >
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg leading-snug font-semibold tracking-[-0.015em]">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-me-1.5 grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-fine:size-8"
            >
              <X className="size-[1.125rem]" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
