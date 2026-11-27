"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowSquareOut, CaretUpDown, List, MagnifyingGlass, SignOut, Sparkle, SquaresFour, Users, X, type Icon,
} from "@phosphor-icons/react";
import { allResources } from "@np/shared";
import { Logo } from "@/components/brand/Logo";
import { ResourceIcon } from "@/components/ResourceIcon";
import { Preferences } from "@/components/layout/Preferences";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { cn, initials } from "@/lib/utils";
import { Assistant } from "./Assistant";
import { CommandMenu } from "./CommandMenu";
import { ShellProvider, useShell } from "./shell-context";

interface NavItem {
  href: string;
  label: string;
  icon: Icon | string;
  section?: string;
  permission?: string;
}

/** Hand-built pages go here; generated resources are added automatically from @np/shared. */
const EXTRA_NAV: NavItem[] = [];

function useNavItems(): NavItem[] {
  const { can } = useAuth();
  const { t } = useI18n();
  const items: NavItem[] = [
    { href: "/app", label: t("nav.overview"), icon: SquaresFour },
    ...allResources().map((r) => ({
      href: `/app/${r.name}`,
      label: r.plural,
      icon: r.icon ?? "Cube",
      section: t("nav.workspace"),
      permission: `${r.name}:read`,
    })),
    ...EXTRA_NAV,
    { href: "/app/users", label: t("nav.users"), icon: Users, section: t("nav.admin"), permission: "users:read" },
  ];
  return items.filter((i) => !i.permission || can(i.permission));
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = useNavItems();
  const groups: { section?: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }

  return (
    <nav aria-label="App" className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <div key={g.section ?? gi} className="flex flex-col gap-0.5">
          {g.section && <p className="px-3 pb-1.5 text-xs font-medium text-sidebar-muted-foreground">{g.section}</p>}
          {g.items.map((item) => {
            const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors pointer-fine:min-h-9",
                  active
                    ? "bg-sidebar-active text-foreground shadow-sm ring-1 ring-border"
                    : "text-sidebar-muted-foreground hover:bg-sidebar-active/70 hover:text-foreground",
                )}
              >
                {typeof item.icon === "string" ? (
                  <ResourceIcon name={item.icon} weight={active ? "duotone" : "regular"} className={cn("size-[1.125rem]", active && "text-primary")} />
                ) : (
                  <item.icon weight={active ? "duotone" : "regular"} className={cn("size-[1.125rem]", active && "text-primary")} aria-hidden="true" />
                )}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SearchButton({ className }: { className?: string }) {
  const { setCommandOpen } = useShell();
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setCommandOpen(true)}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground pointer-fine:min-h-9",
        className,
      )}
    >
      <MagnifyingGlass className="size-4" aria-hidden="true" />
      <span className="flex-1 truncate text-start">{t("nav.search")}</span>
      <kbd className="kbd hidden pointer-fine:inline-flex">⌘K</kbd>
    </button>
  );
}

function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user, hasRole, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  if (!user) return null;

  async function signOut(all = false) {
    if (all) await api("/auth/logout-all", { method: "POST" }).catch(() => {});
    await logout();
    router.replace("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("account.menu")}
        className={cn(
          "flex items-center gap-2.5 rounded-lg text-start outline-none transition-colors hover:bg-sidebar-active/70 focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "p-1" : "w-full p-2",
        )}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-brand-soft text-xs font-semibold text-brand-ink">{initials(user.fullName, user.email)}</AvatarFallback>
        </Avatar>
        {!compact && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{user.fullName}</span>
              <span className="block truncate text-xs text-muted-foreground">{hasRole("admin") ? t("account.admin") : t("account.member")}</span>
            </span>
            <CaretUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium text-foreground">{user.fullName}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/" />}>
          <ArrowSquareOut /> {t("nav.viewSite")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut(true)}>
          <SignOut className="rtl:rotate-180" /> {t("account.logoutAll")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()}>
          <SignOut className="rtl:rotate-180" /> {t("account.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssistantButton({ className }: { className?: string }) {
  const { openAssistant } = useShell();
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => openAssistant()}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-sidebar-muted-foreground transition-colors hover:bg-sidebar-active/70 hover:text-foreground pointer-fine:min-h-9",
        className,
      )}
    >
      <Sparkle weight="duotone" className="size-[1.125rem] text-primary" aria-hidden="true" />
      <span className="flex-1 text-start">{t("cmd.ask")}</span>
      <kbd className="kbd hidden pointer-fine:inline-flex">⌘J</kbd>
    </button>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { setCommandOpen, openAssistant } = useShell();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const sidebar = (onNavigate?: () => void) => (
    <>
      <SearchButton />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
        <AssistantButton />
        <AccountMenu />
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-md">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col gap-4 border-e border-sidebar-border bg-sidebar px-3 pt-4 pb-3 lg:flex">
        <div className="flex items-center justify-between ps-2">
          <Link href="/app" className="rounded-md"><Logo /></Link>
          <Preferences />
        </div>
        {sidebar()}
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-[oklch(0.2_0.02_262/0.4)] animate-[fade-in_160ms_ease-out_backwards]"
            aria-label={t("nav.closeMenu")}
            onClick={() => setDrawer(false)}
          />
          <aside className="relative flex h-full w-[min(20rem,86vw)] flex-col gap-4 bg-sidebar px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg animate-[rise_240ms_var(--ease-out)_backwards]">
            <div className="flex items-center justify-between ps-2">
              <Logo />
              <Button variant="ghost" size="icon-sm" aria-label={t("nav.closeMenu")} onClick={() => setDrawer(false)}>
                <X />
              </Button>
            </div>
            {sidebar(() => setDrawer(false))}
          </aside>
        </div>
      )}

      <div className="lg:ps-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-border bg-background/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
          <Button variant="ghost" size="icon-sm" aria-label={t("nav.openMenu")} aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <List />
          </Button>
          <Link href="/app" className="me-auto rounded-md"><Logo /></Link>
          <Button variant="ghost" size="icon-sm" aria-label={t("nav.search")} onClick={() => setCommandOpen(true)}>
            <MagnifyingGlass />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t("cmd.ask")} onClick={() => openAssistant()}>
            <Sparkle weight="duotone" className="text-primary" />
          </Button>
          <AccountMenu compact />
        </header>

        <main id="main" key={pathname} className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] animate-[rise_320ms_var(--ease-out)_backwards] sm:px-6 lg:px-10 lg:pt-10">
          {children}
        </main>
      </div>

      <CommandMenu />
      <Assistant />
    </div>
  );
}

/** Authenticated app shell: sidebar (drawer on phones), ⌘K command palette and the AI assistant. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <Shell>{children}</Shell>
    </ShellProvider>
  );
}
