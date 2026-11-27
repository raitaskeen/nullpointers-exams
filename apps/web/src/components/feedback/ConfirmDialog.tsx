"use client";

import { useState, type ReactNode } from "react";
import { CircleNotch as Loader2Icon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Confirmation step for destructive actions (kit sections 4 and 7). The confirm button is disabled while
 * onConfirm runs, so a double click can't fire the action twice.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** May be async; the dialog closes only after it resolves. Throw to keep it open. */
  onConfirm: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Caller is responsible for surfacing the error (e.g. a toast); keep the dialog open so they can retry.
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={pending}
            variant={destructive ? "destructive" : "default"}
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
