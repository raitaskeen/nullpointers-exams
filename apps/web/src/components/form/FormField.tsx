"use client";

import { useId, type ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Label + control + hint + error, wired for screen readers. The control is rendered by `children(id, describedBy)`
 * so it can be any input. Errors come from the shared Zod schema, or from the API (same message, same field).
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ms-0.5 text-danger" aria-hidden="true">*</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && <p id={hintId} className="text-[0.8125rem] text-muted-foreground">{hint}</p>}
      {error && (
        <p id={errId} role="alert" className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger animate-[rise_200ms_var(--ease-out)_backwards]">
          <WarningCircle weight="fill" className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/** iOS-style segmented control with a sliding thumb. Keyboard: arrow keys move between options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "default",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
  size?: "default" | "sm";
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative inline-grid rounded-[0.75rem] border border-[var(--glass-border)] bg-muted/70 p-[3px] shadow-[inset_0_1px_2px_oklch(0.2_0.02_262/0.06)]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const dir = (e.key === "ArrowRight") !== (document.dir === "rtl") ? 1 : -1;
        const next = options[(index + dir + options.length) % options.length]!;
        onChange(next.value);
        (e.currentTarget.querySelectorAll("button")[options.indexOf(next)] as HTMLButtonElement | undefined)?.focus();
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-[3px] start-[3px] rounded-[0.6rem] bg-surface shadow-[var(--glass-edge),0_1px_3px_oklch(0.2_0.02_262/0.12)] transition-transform duration-300 ease-[var(--ease-out)]"
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(calc(${index * 100}% * var(--dir, 1)))` }}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-[0.6rem] px-3 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              size === "sm" ? "h-9 text-[0.8125rem] pointer-fine:h-7" : "h-10 text-sm pointer-fine:h-8",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Check/radio tile used for answer options: big target, clear state, never color alone. */
export function ChoiceTile({
  type,
  checked,
  onChange,
  children,
  name,
  disabled,
  className,
  marker,
}: {
  type: "radio" | "checkbox";
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  name?: string;
  disabled?: boolean;
  className?: string;
  marker?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "group relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-[background-color,border-color,box-shadow,transform] duration-200 ease-[var(--ease-out)] active:scale-[0.995]",
        checked
          ? "border-primary/60 bg-brand-softer shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_14%,transparent)]"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-sunken/60",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input type={type} name={name} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "grid size-6 shrink-0 place-items-center border-2 text-[0.6875rem] font-semibold transition-all duration-200 peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40",
          type === "radio" ? "rounded-full" : "rounded-md",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-control-border text-muted-foreground",
        )}
      >
        {checked ? (
          type === "radio" ? <span className="size-2 rounded-full bg-current" /> : <svg viewBox="0 0 12 12" className="size-3"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : (
          marker
        )}
      </span>
      <span className="min-w-0 flex-1 text-[0.9375rem] leading-snug">{children}</span>
    </label>
  );
}

export const inputCls =
  "h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-control-border/70 bg-surface px-3 text-base text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-danger aria-invalid:ring-danger/15 disabled:opacity-50 pointer-fine:h-10 sm:text-sm";
export const textareaCls =
  "min-h-24 w-full rounded-[var(--radius-control)] border border-control-border/70 bg-surface px-3 py-2.5 text-base leading-relaxed text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-danger sm:text-sm";
export const selectCls =
  "h-11 w-full cursor-pointer appearance-none rounded-[var(--radius-control)] border border-control-border/70 bg-surface bg-[length:16px] bg-[position:right_0.75rem_center] bg-no-repeat ps-3 pe-9 text-base text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 pointer-fine:h-10 sm:text-sm";
