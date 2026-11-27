"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { WarningCircle as AlertCircle, Check, Eye, EyeSlash as EyeOff, X } from "@phosphor-icons/react";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthFieldProps = {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
  registration: UseFormRegisterReturn;
  error?: string;
  /** Field has been edited - gates the valid/invalid indicator so an untouched field isn't judged. */
  dirty?: boolean;
  /** Clears the field (resetField + setFocus) - shown as a real button when the value is invalid. */
  onClear?: () => void;
  /** Small right-aligned note on the label row, e.g. "8+ characters". */
  hint?: ReactNode;
};

/**
 * One auth form row: label (+ hint), input, a trailing control, and the error line.
 *
 * Trailing control: an invalid field gets a real clear button, not a decorative X. (The old
 * ValidationIcon was pointer-events-none, so clicking it did nothing - Junaid, 2026-11-25.)
 * A valid field gets a non-interactive check. Password fields always get a show/hide toggle.
 */
export function AuthField({
  id,
  label,
  type = "text",
  autoComplete,
  placeholder,
  registration,
  error,
  dirty = false,
  onClear,
  hint,
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const invalid = !!error;
  const showValid = dirty && !invalid;
  const showClear = dirty && invalid && !!onClear && !isPassword;
  const errorId = `${id}-error`;
  // Remember the last message so it can fade out instead of vanishing mid-transition.
  const lastError = useRef(error);
  if (error) lastError.current = error;
  const shownError = error ?? lastError.current;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>

      <div className="relative">
        <Input
          id={id}
          type={isPassword && revealed ? "text" : type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          className={cn("h-12 pointer-fine:h-11", isPassword ? "pe-[4.75rem]" : "pe-11")}
          {...registration}
        />

        <div className="absolute inset-y-0 end-1.5 flex items-center gap-0.5">
          {showValid && (
            <span className="flex size-8 items-center justify-center" aria-hidden="true">
              <Check className="size-4 text-success" />
            </span>
          )}
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label={`Clear ${label.toLowerCase()}`}
              className="flex size-9 items-center justify-center rounded-md text-destructive transition-[background-color,transform] duration-150 ease-out hover:bg-destructive/10 active:scale-[0.92]"
            >
              <X className="size-4" />
            </button>
          )}
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-accent hover:text-foreground active:scale-[0.92]"
            >
              {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Reserved, fixed-height error slot: the message fades/slides in place instead of being
          inserted, so typing never grows the card or shoves the fields below it (layout shift
          reported by Junaid, 2026-11-25). The last message is kept during the fade-out. */}
      <p
        id={errorId}
        aria-live="polite"
        className={cn(
          "flex min-h-4 items-center gap-1.5 text-xs leading-4 text-danger transition-[opacity,transform] duration-150 ease-out",
          invalid ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-0.5 opacity-0"
        )}
      >
        {shownError && (
          <>
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{shownError}</span>
          </>
        )}
      </p>
    </div>
  );
}

/** Full-width primary submit. While submitting it shows a spinner, keeps its width and can't double-fire. */
export function AuthSubmit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full" aria-busy={pending}>
      {pending && <CircleNotch className="animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </Button>
  );
}
