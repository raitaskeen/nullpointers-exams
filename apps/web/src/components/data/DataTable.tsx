"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CaretLeft as ChevronLeft, CaretRight as ChevronRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingRows } from "@/components/feedback/States";
import { cn } from "@/lib/utils";

export interface DataColumn<T> {
  /** Stable key for React; not shown to users. */
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Hide this column below a breakpoint so tables stay usable on mobile (kit section 4). */
  hideBelow?: "sm" | "md" | "lg";
  className?: string;
  /** Right-align numeric/action columns. */
  align?: "left" | "right";
}

const hideBelowClass = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
} as const;

/**
 * Generic, token-driven table with built-in loading / error / empty states.
 * Pagination is client-side by default; pass `serverPagination` when the API pages the data (resource lists do).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading,
  error,
  onRetry,
  emptyTitle = "No records yet",
  emptyDescription,
  emptyAction,
  pageSize = 10,
  caption,
  serverPagination,
}: {
  columns: DataColumn<T>[];
  rows: T[] | undefined;
  getRowId: (row: T) => string | number;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  pageSize?: number;
  /** Screen-reader description of the table. */
  caption?: string;
  serverPagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
}) {
  const [clientPage, setClientPage] = useState(1);
  const page = serverPagination?.page ?? clientPage;
  const effectivePageSize = serverPagination?.pageSize ?? pageSize;
  const total = serverPagination?.total ?? rows?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));
  const setPage = (update: (p: number) => number) =>
    serverPagination ? serverPagination.onPageChange(update(page)) : setClientPage(update);

  // If a filter shrinks the list, don't leave the user stranded on a page that no longer exists.
  useEffect(() => {
    if (!serverPagination && clientPage > pageCount) setClientPage(pageCount);
  }, [serverPagination, clientPage, pageCount]);

  const pageRows = useMemo(
    () => (serverPagination ? rows ?? [] : (rows ?? []).slice((page - 1) * pageSize, page * pageSize)),
    [serverPagination, rows, page, pageSize]
  );

  if (isLoading) return <LoadingRows rows={Math.min(pageSize, 5)} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (total === 0) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  const alignClass = (align?: "left" | "right") => (align === "right" ? "text-right" : undefined);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader className="bg-muted/60">
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.id}
                scope="col"
                className={cn(
                  "px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                  col.hideBelow && hideBelowClass[col.hideBelow],
                  alignClass(col.align),
                  col.className
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((row) => (
            <TableRow key={getRowId(row)}>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  className={cn(
                    "px-4 py-3",
                    col.hideBelow && hideBelowClass[col.hideBelow],
                    alignClass(col.align),
                    col.className
                  )}
                >
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground"
        >
          <span>
            Page {page} of {pageCount} · {total} {total === 1 ? "record" : "records"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
