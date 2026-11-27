"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, CaretRight, FunnelSimple, MagnifyingGlass, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { listFields, type FieldDef, type ResourceDef } from "@np/shared";
import { ResourceIcon } from "@/components/ResourceIcon";
import { Pagination } from "@/components/data/Pagination";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useLiveResource } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { FormattedValue, humanize } from "./format";
import { useDeleteResource, useOptions, useResourceItem, useResourceList, type Row } from "./hooks";

function RefValue({ field, value }: { field: Extract<FieldDef, { type: "ref" }>; value: unknown }) {
  const { data } = useOptions(field.to);
  return <FormattedValue field={field} value={value} refLabel={data?.find((o) => o.id === value)?.label} />;
}

function Cell({ field, value }: { field: FieldDef; value: unknown }) {
  return field.type === "ref" ? <RefValue field={field} value={value} /> : <FormattedValue field={field} value={value} />;
}

/** List state lives in the URL: back/forward work, and any view (filtered, sorted, a record open) is shareable. */
function useListParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>, resetPage = true) => {
      const next = new URLSearchParams(sp.toString());
      if (resetPage) next.delete("page");
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );
  return { sp, set };
}

export function ResourceListPage({ def }: { def: ResourceDef }) {
  const { can } = useAuth();
  const { t, intl } = useI18n();
  const { sp, set } = useListParams();

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = [10, 20, 50].includes(Number(sp.get("pageSize"))) ? Number(sp.get("pageSize")) : 20;
  const sort = sp.get("sort") ?? "";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const q = sp.get("q") ?? "";
  const viewId = Number(sp.get("view")) || null;

  const filterable = useMemo(() => Object.entries(def.fields).filter(([, f]) => f.type === "enum" || f.type === "boolean"), [def]);
  const filters = Object.fromEntries(filterable.map(([k]) => [k, sp.get(k) ?? ""]));
  const activeFilters = Object.entries(filters).filter(([, v]) => v);

  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    if (search === q) return;
    const id = setTimeout(() => set({ q: search.trim() || null }), 250);
    return () => clearTimeout(id);
  }, [search, q, set]);

  const list = useResourceList(def, { page, pageSize, q, sort: sort || undefined, dir: sort ? dir : undefined, ...filters });
  const del = useDeleteResource(def);
  const { connected } = useLiveResource(def.name, !!def.realtime);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const cols = listFields(def);
  const [titleKey, titleField] = cols[0] ?? Object.entries(def.fields)[0]!;
  const canCreate = can(`${def.name}:create`);
  const canEdit = can(`${def.name}:update`);
  const canDelete = can(`${def.name}:delete`);
  const total = list.data?.total ?? 0;
  const rows = list.data?.items ?? [];
  const filtered = !!q || activeFilters.length > 0;

  const toggleSort = (key: string) => {
    if (sort !== key) set({ sort: key, dir: "asc" });
    else if (dir === "asc") set({ sort: key, dir: "desc" });
    else set({ sort: null, dir: null });
  };

  const createButton = canCreate ? (
    <Button render={<Link href={`/app/${def.name}/new`} />}>
      <Plus weight="bold" />
      {t("form.new", { singular: def.singular.toLowerCase() })}
    </Button>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-ink">
            <ResourceIcon name={def.icon} weight="duotone" className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl leading-tight font-semibold tracking-[-0.025em]">{def.plural}</h1>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <span className="tabular-nums">{new Intl.NumberFormat(intl).format(total)}</span>
              {def.realtime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-warning animate-pulse")} aria-hidden="true" />
                    {connected ? t("list.live") : t("list.connecting")}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        {createButton}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <MagnifyingGlass className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("list.search", { plural: def.plural.toLowerCase() })}
            aria-label={t("list.search", { plural: def.plural.toLowerCase() })}
            className="ps-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:flex">
          {filterable.map(([key, field]) => (
            <NativeSelect
              key={key}
              aria-label={field.label}
              value={filters[key]}
              onChange={(e) => set({ [key]: e.target.value || null })}
              className="sm:w-40"
            >
              <option value="">{`${field.label}: ${t("common.all")}`}</option>
              {field.type === "enum"
                ? field.options.map((o) => <option key={o} value={o}>{humanize(o)}</option>)
                : [<option key="t" value="true">{t("common.yes")}</option>, <option key="f" value="false">{t("common.no")}</option>]}
            </NativeSelect>
          ))}
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); set(Object.fromEntries([["q", null], ...filterable.map(([k]) => [k, null])])); }}>
            <X /> {t("list.clear")}
          </Button>
        )}
      </div>

      {/* Results */}
      {list.error ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0">
              <div className="skeleton h-4 flex-1 rounded" />
              <div className="skeleton hidden h-5 w-20 rounded-full sm:block" />
              <div className="skeleton hidden h-4 w-24 rounded md:block" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={filtered ? t("list.noMatch") : t("list.empty", { plural: def.plural.toLowerCase() })}
          description={filtered ? t("list.noMatchHint") : t("list.emptyHint")}
          action={filtered ? undefined : createButton}
        />
      ) : (
        <>
          {/* Phones: cards (no sideways scrolling, 44px+ targets) */}
          <ul className="space-y-2.5 sm:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => set({ view: row.id }, false)}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 text-start shadow-xs transition-colors active:bg-muted"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="truncate font-medium"><Cell field={titleField} value={row[titleKey]} /></div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                      {cols.slice(1, 4).map(([k, f]) => (
                        <span key={k} className="max-w-full truncate"><Cell field={f} value={row[k]} /></span>
                      ))}
                    </div>
                  </div>
                  <CaretRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {/* Tablet/desktop: table */}
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-xs sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{def.plural}</caption>
                <thead className="border-b border-border bg-surface-sunken text-start">
                  <tr>
                    {cols.map(([k, f], i) => (
                      <th
                        key={k}
                        scope="col"
                        aria-sort={sort === k ? (dir === "asc" ? "ascending" : "descending") : "none"}
                        className={cn("h-11 px-4 text-start text-xs font-medium text-muted-foreground", i >= 3 && "hidden lg:table-cell", (f.type === "int" || f.type === "number") && "text-end")}
                      >
                        <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 rounded hover:text-foreground">
                          {f.label}
                          {sort === k ? (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <FunnelSimple className="size-3 opacity-0" aria-hidden="true" />}
                        </button>
                      </th>
                    ))}
                    {(canEdit || canDelete) && <th scope="col" className="w-24 px-4"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => set({ view: row.id }, false)}
                      className="group cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/60"
                    >
                      {cols.map(([k, f], i) => (
                        <td key={k} className={cn("h-14 px-4", i >= 3 && "hidden lg:table-cell", (f.type === "int" || f.type === "number") && "text-end", i === 0 && "font-medium")}>
                          {i === 0 ? (
                            <button type="button" className="max-w-[22rem] truncate text-start outline-none focus-visible:underline" onClick={(e) => { e.stopPropagation(); set({ view: row.id }, false); }}>
                              <Cell field={f} value={row[k]} />
                            </button>
                          ) : (
                            <Cell field={f} value={row[k]} />
                          )}
                        </td>
                      ))}
                      {(canEdit || canDelete) && (
                        <td className="px-3 text-end" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            {canEdit && (
                              <Button variant="ghost" size="icon-xs" aria-label={`${t("common.edit")} ${def.singular}`} render={<Link href={`/app/${def.name}/${row.id}`} />}>
                                <PencilSimple />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon-xs" aria-label={`${t("common.delete")} ${def.singular}`} onClick={() => setToDelete(row)}>
                                <Trash className="text-danger" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => { set({ page: p }, false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            onPageSizeChange={(s) => set({ pageSize: s })}
          />
        </>
      )}

      <RecordSheet
        def={def}
        id={viewId}
        onClose={() => set({ view: null }, false)}
        onDelete={(row) => setToDelete(row)}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("list.deleteTitle", { singular: def.singular.toLowerCase() })}
        description={t("list.deleteBody")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (toDelete) {
            await del.mutateAsync(toDelete.id);
            if (viewId === toDelete.id) set({ view: null }, false);
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}

function RecordSheet({
  def, id, onClose, onDelete, canEdit, canDelete,
}: { def: ResourceDef; id: number | null; onClose: () => void; onDelete: (r: Row) => void; canEdit: boolean; canDelete: boolean }) {
  const { t, intl } = useI18n();
  const item = useResourceItem(def, id);
  const row = item.data;
  const [titleKey] = listFields(def)[0] ?? Object.keys(def.fields);
  const stamp = (iso?: string) => (iso ? new Intl.DateTimeFormat(intl, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—");

  return (
    <Sheet
      open={id !== null}
      onOpenChange={(o) => !o && onClose()}
      title={row ? String(row[titleKey as string] ?? `#${row.id}`) : def.singular}
      description={`${def.singular} #${id ?? ""}`}
      footer={
        row && (canEdit || canDelete) ? (
          <>
            {canDelete && (
              <Button variant="destructive-soft" onClick={() => onDelete(row)}>
                <Trash /> {t("common.delete")}
              </Button>
            )}
            {canEdit && (
              <Button render={<Link href={`/app/${def.name}/${row.id}`} />}>
                <PencilSimple /> {t("common.edit")}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {item.isLoading ? (
        <div className="space-y-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
      ) : item.error || !row ? (
        <ErrorState onRetry={() => item.refetch()} />
      ) : (
        <dl className="divide-y divide-border">
          {Object.entries(def.fields).map(([k, f]) => (
            <div key={k} className="grid gap-1 py-3.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
              <dt className="text-sm text-muted-foreground">{f.label}</dt>
              <dd className="text-sm break-words"><Cell field={f} value={row[k]} /></dd>
            </div>
          ))}
          <div className="grid gap-1 py-3.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-sm text-muted-foreground">{t("list.created")}</dt>
            <dd className="text-sm tabular-nums">{stamp(row.createdAt)}</dd>
          </div>
          <div className="grid gap-1 py-3.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-sm text-muted-foreground">{t("list.updated")}</dt>
            <dd className="text-sm tabular-nums">{stamp(row.updatedAt)}</dd>
          </div>
        </dl>
      )}
    </Sheet>
  );
}
