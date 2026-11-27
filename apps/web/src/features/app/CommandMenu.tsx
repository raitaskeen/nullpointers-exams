"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, MagnifyingGlass, Moon, Plus, SignOut, Sparkle, SquaresFour, Sun, Translate, Users } from "@phosphor-icons/react";
import { allResources, type Page, type ResourceDef } from "@np/shared";
import { ResourceIcon } from "@/components/ResourceIcon";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { LOCALES, useI18n } from "@/lib/i18n";
import { PALETTES, usePalette } from "@/lib/palette";
import { useTheme } from "@/lib/theme-provider";
import { useShell } from "./shell-context";

const labelKey = (def: ResourceDef) =>
  Object.entries(def.fields).find(([, f]) => f.type === "string" || f.type === "email")?.[0];

function useDebounced(value: string, ms = 180) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

const itemCls =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-foreground-soft outline-none select-none data-[selected=true]:bg-muted data-[selected=true]:text-foreground pointer-fine:min-h-10 [&_svg]:size-[1.125rem] [&_svg]:shrink-0 [&_svg]:text-muted-foreground";
const groupCls =
  "px-2 pb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

/** ⌘K: navigate, search records across every resource, create, change preferences, or ask the assistant. */
export function CommandMenu() {
  const { commandOpen: open, setCommandOpen: setOpen, openAssistant } = useShell();
  const { t, setLocale } = useI18n();
  const { can, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { setPalette } = usePalette();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());

  const readable = useMemo(() => allResources().filter((r) => can(`${r.name}:read`)), [can]);
  const creatable = readable.filter((r) => can(`${r.name}:create`));

  const results = useQueries({
    queries: readable.map((r) => ({
      queryKey: ["resource", r.name, "cmdk", q],
      queryFn: () => api<Page<Record<string, unknown> & { id: number }>>(`/${r.name}?q=${encodeURIComponent(q)}&pageSize=5`),
      enabled: open && q.length >= 2,
      staleTime: 10_000,
    })),
  });

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };
  const go = (href: string) => run(() => router.push(href));

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("cmd.placeholder")}
      loop
      overlayClassName="fixed inset-0 z-50 bg-[oklch(0.2_0.02_262/0.32)] backdrop-blur-[2px] animate-[fade-in_140ms_ease-out_backwards]"
      contentClassName="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto max-w-xl overflow-hidden rounded-2xl border border-border-strong bg-popover text-popover-foreground shadow-lg animate-[rise_220ms_var(--ease-out)_backwards] sm:top-[14vh]"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <MagnifyingGlass className="size-5 text-muted-foreground" aria-hidden="true" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder={t("cmd.placeholder")}
          className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <kbd className="kbd hidden sm:inline-flex">esc</kbd>
      </div>
      <Command.List className="max-h-[min(60vh,28rem)] scroll-py-2 overflow-y-auto overscroll-contain py-2">
        {search.trim().length < 2 && (
          <Command.Empty className="px-4 py-10 text-center text-sm text-muted-foreground">{t("cmd.empty")}</Command.Empty>
        )}

        {readable.map((r, i) => {
          const items = results[i]?.data?.items ?? [];
          const key = labelKey(r);
          if (!items.length) return null;
          return (
            <Command.Group forceMount key={r.name} heading={r.plural} className={groupCls}>
              {items.map((row) => (
                <Command.Item
                  key={row.id}
                  forceMount
                  value={`${r.name}-${row.id}`}
                  onSelect={() => go(`/app/${r.name}?view=${row.id}`)}
                  className={itemCls}
                >
                  <ResourceIcon name={r.icon} />
                  <span className="flex-1 truncate">{String((key && row[key]) ?? `#${row.id}`)}</span>
                  <ArrowRight className="rtl:rotate-180" />
                </Command.Item>
              ))}
            </Command.Group>
          );
        })}

        <Command.Group heading={t("cmd.navigate")} className={groupCls}>
          <Command.Item value="overview dashboard home" onSelect={() => go("/app")} className={itemCls}>
            <SquaresFour /> {t("nav.overview")}
          </Command.Item>
          {readable.map((r) => (
            <Command.Item key={r.name} value={`go ${r.plural} ${r.name}`} onSelect={() => go(`/app/${r.name}`)} className={itemCls}>
              <ResourceIcon name={r.icon} /> {r.plural}
            </Command.Item>
          ))}
          {can("users:read") && (
            <Command.Item value="people users team admin" onSelect={() => go("/app/users")} className={itemCls}>
              <Users /> {t("nav.users")}
            </Command.Item>
          )}
        </Command.Group>

        {creatable.length > 0 && (
          <Command.Group heading={t("cmd.create")} className={groupCls}>
            {creatable.map((r) => (
              <Command.Item key={r.name} value={`new create add ${r.singular}`} onSelect={() => go(`/app/${r.name}/new`)} className={itemCls}>
                <Plus /> {t("form.new", { singular: r.singular.toLowerCase() })}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {search.trim().length >= 2 && (
          <Command.Group forceMount heading={t("cmd.ask")} className={groupCls}>
            <Command.Item forceMount value={`ask ${search}`} onSelect={() => openAssistant(search.trim())} className={itemCls}>
              <Sparkle weight="duotone" className="!text-primary" />
              <span className="flex-1 truncate">“{search.trim()}”</span>
              <kbd className="kbd">↵</kbd>
            </Command.Item>
          </Command.Group>
        )}

        <Command.Group heading={t("cmd.preferences")} className={groupCls}>
          <Command.Item value="ask ai assistant chat" onSelect={() => openAssistant()} className={itemCls}>
            <Sparkle weight="duotone" /> {t("cmd.ask")}
            <span className="ms-auto flex gap-1">
              <kbd className="kbd">⌘</kbd>
              <kbd className="kbd">J</kbd>
            </span>
          </Command.Item>
          <Command.Item
            value="theme dark light appearance"
            onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
            className={itemCls}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            {resolvedTheme === "dark" ? t("account.light") : t("account.dark")}
          </Command.Item>
          {LOCALES.map((l) => (
            <Command.Item key={l.id} value={`language ${l.label} ${l.id}`} onSelect={() => run(() => setLocale(l.id))} className={itemCls}>
              <Translate /> {l.label}
            </Command.Item>
          ))}
          {PALETTES.map((p) => (
            <Command.Item key={p.id} value={`brand color palette ${p.label} ${p.hint}`} onSelect={() => run(() => setPalette(p.id))} className={itemCls}>
              <span className="size-[1.125rem] rounded-full border border-border" style={{ background: p.swatch }} aria-hidden="true" />
              {p.label}
              <span className="ms-auto truncate text-xs text-muted-foreground">{p.hint}</span>
            </Command.Item>
          ))}
          <Command.Item value="log out sign out" onSelect={() => run(async () => { await logout(); router.replace("/login"); })} className={itemCls}>
            <SignOut className="rtl:rotate-180" /> {t("account.logout")}
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
