"use client";

import type { FieldDef } from "@np/shared";
import { StatusBadge, type StatusTone } from "@/components/feedback/StatusBadge";
import { useI18n } from "@/lib/i18n";

const TONES: [RegExp, StatusTone][] = [
  [/^(done|complete|completed|active|approved|paid|resolved|open|available|published|live|success|confirmed|delivered|accepted)$/i, "success"],
  [/^(pending|doing|in[-_ ]?progress|review|waiting|draft|planning|scheduled|hold|on[-_ ]?hold|processing|shipped)$/i, "warning"],
  [/^(cancel+ed|rejected|failed|overdue|closed|blocked|unpaid|expired|archived|error|urgent|critical|high)$/i, "danger"],
];

export function enumTone(value: string): StatusTone {
  return TONES.find(([re]) => re.test(value))?.[1] ?? "info";
}

export const humanize = (s: string) => s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Display a stored value the way a person expects to read it, in the active locale. */
export function FormattedValue({ field, value, refLabel }: { field: FieldDef; value: unknown; refLabel?: string }) {
  const { intl, t } = useI18n();
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  switch (field.type) {
    case "enum":
      return <StatusBadge tone={enumTone(String(value))}>{humanize(String(value))}</StatusBadge>;
    case "boolean":
      return value ? <StatusBadge tone="success">{t("common.yes")}</StatusBadge> : <StatusBadge tone="neutral">{t("common.no")}</StatusBadge>;
    case "date":
      return <time dateTime={String(value)}>{new Intl.DateTimeFormat(intl, { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`))}</time>;
    case "datetime":
      return <time dateTime={String(value)}>{new Intl.DateTimeFormat(intl, { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value)))}</time>;
    case "int":
    case "number":
      return <span className="tabular-nums">{new Intl.NumberFormat(intl, { maximumFractionDigits: 2 }).format(Number(value))}</span>;
    case "ref":
      return <span>{refLabel ?? `#${value}`}</span>;
    case "url":
      return (
        <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline" onClick={(e) => e.stopPropagation()}>
          {String(value).replace(/^https?:\/\//, "")}
        </a>
      );
    case "email":
      return <a href={`mailto:${value}`} className="break-all hover:underline" onClick={(e) => e.stopPropagation()}>{String(value)}</a>;
    case "text":
      return <span className="line-clamp-2 max-w-md whitespace-pre-line">{String(value)}</span>;
    default:
      return <span className="break-words">{String(value)}</span>;
  }
}

/** Convert a stored ISO datetime into the value a datetime-local input expects (local time). */
export function toDateTimeLocal(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
