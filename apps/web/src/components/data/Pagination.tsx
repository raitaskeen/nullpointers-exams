"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** 1 … 4 5 [6] 7 8 … 20 - with the current page always visible and the ends always reachable. */
function pageList(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

const btn =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-40 pointer-fine:h-8 pointer-fine:min-w-8";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  sizes = [10, 20, 50],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  sizes?: number[];
}) {
  const { t, intl } = useI18n();
  const count = Math.max(1, Math.ceil(total / pageSize));
  const fmt = new Intl.NumberFormat(intl);
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="tabular-nums" aria-live="polite">
          {t("list.showing", { from: fmt.format(from), to: fmt.format(to), total: fmt.format(total) })}
        </span>
        {onPageSizeChange && (
          <label className="hidden items-center gap-2 sm:flex">
            <span>{t("list.rows")}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {count > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={cn(btn, "hover:bg-muted")} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label={t("list.prev")}>
            <CaretLeft className="size-4 rtl:rotate-180" />
          </button>
          <span className="contents max-sm:hidden">
            {pageList(page, count).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden="true">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-label={t("list.page", { page: p })}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(btn, p === page ? "bg-foreground text-background" : "text-foreground-soft hover:bg-muted")}
                >
                  {fmt.format(p)}
                </button>
              ),
            )}
          </span>
          <span className="px-2 text-sm text-muted-foreground tabular-nums sm:hidden">
            {fmt.format(page)} / {fmt.format(count)}
          </span>
          <button type="button" className={cn(btn, "hover:bg-muted")} onClick={() => onPageChange(page + 1)} disabled={page >= count} aria-label={t("list.next")}>
            <CaretRight className="size-4 rtl:rotate-180" />
          </button>
        </div>
      )}
    </nav>
  );
}
