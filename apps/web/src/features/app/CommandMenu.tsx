"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Books, ClipboardText, MagnifyingGlass, Moon, Plus, Scales, SealCheck, SignOut, SquaresFour, Sun, Users, Seal,
} from "@phosphor-icons/react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { PHASE_LABEL, type ExamListRow, type MyExam } from "@/lib/exams";
import { useI18n } from "@/lib/i18n";
import { PALETTES, usePalette } from "@/lib/palette";
import { useTheme } from "@/lib/theme-provider";
import { useShell } from "./shell-context";

const itemCls =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-foreground-soft outline-none select-none data-[selected=true]:bg-muted data-[selected=true]:text-foreground pointer-fine:min-h-10 [&_svg]:size-[1.125rem] [&_svg]:shrink-0 [&_svg]:text-muted-foreground";
const groupCls =
  "px-2 pb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

/** ⌘K: jump to any exam or page, start common actions, change preferences. */
export function CommandMenu() {
  const { commandOpen: open, setCommandOpen: setOpen } = useShell();
  const { t } = useI18n();
  const { can, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { setPalette } = usePalette();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const examiner = can("exams:manage");
  const candidate = can("exams:take");

  const exams = useQuery({ queryKey: ["exams"], queryFn: () => api<ExamListRow[]>("/exams"), enabled: open && examiner });
  const mine = useQuery({ queryKey: ["me", "exams"], queryFn: () => api<MyExam[]>("/me/exams"), enabled: open && candidate && !examiner });

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
      overlayClassName="fixed inset-0 z-50 bg-[oklch(0.2_0.02_262/0.32)] animate-[fade-in_140ms_ease-out_backwards]"
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
        <Command.Empty className="px-4 py-10 text-center text-sm text-muted-foreground">{t("cmd.empty")}</Command.Empty>

        {examiner && !!exams.data?.length && (
          <Command.Group heading={t("nav.exams")} className={groupCls}>
            {exams.data.map((e) => (
              <Command.Item key={e.id} value={`exam ${e.title} ${e.id}`} onSelect={() => go(`/app/exams/view?id=${e.id}`)} className={itemCls}>
                <ClipboardText />
                <span className="flex-1 truncate">{e.title}</span>
                <span className="text-xs text-muted-foreground">{PHASE_LABEL[e.phase]}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {!examiner && candidate && !!mine.data?.length && (
          <Command.Group heading={t("dash.myExams")} className={groupCls}>
            {mine.data.map((e) => (
              <Command.Item key={e.id} value={`exam ${e.title} ${e.id}`} onSelect={() => go(`/app?exam=${e.id}`)} className={itemCls}>
                <ClipboardText />
                <span className="flex-1 truncate">{e.title}</span>
                <span className="text-xs text-muted-foreground">{PHASE_LABEL[e.phase]}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading={t("cmd.navigate")} className={groupCls}>
          <Command.Item value="overview dashboard home" onSelect={() => go("/app")} className={itemCls}>
            <SquaresFour /> {t("nav.overview")}
          </Command.Item>
          {examiner && (
            <>
              <Command.Item value="exams list" onSelect={() => go("/app/exams")} className={itemCls}>
                <ClipboardText /> {t("nav.exams")}
              </Command.Item>
              <Command.Item value="question bank questions" onSelect={() => go("/app/questions")} className={itemCls}>
                <Books /> {t("nav.questions")}
              </Command.Item>
              <Command.Item value="disputes appeals" onSelect={() => go("/app/disputes")} className={itemCls}>
                <Scales /> {t("nav.disputes")}
              </Command.Item>
            </>
          )}
          {candidate && (
            <Command.Item value="results grades my results" onSelect={() => go("/app/results")} className={itemCls}>
              <SealCheck /> {t("nav.results")}
            </Command.Item>
          )}
          {can("users:read") && (
            <Command.Item value="people users accounts admin" onSelect={() => go("/app/users")} className={itemCls}>
              <Users /> {t("nav.users")}
            </Command.Item>
          )}
          <Command.Item value="verify certificate result code" onSelect={() => go("/verify")} className={itemCls}>
            <Seal /> {t("cmd.verify")}
          </Command.Item>
        </Command.Group>

        {examiner && (
          <Command.Group heading={t("cmd.create")} className={groupCls}>
            <Command.Item value="new exam create" onSelect={() => go("/app/exams?new=1")} className={itemCls}>
              <Plus /> {t("cmd.newExam")}
            </Command.Item>
            <Command.Item value="new question create add" onSelect={() => go("/app/questions?new=1")} className={itemCls}>
              <Plus /> {t("cmd.newQuestion")}
            </Command.Item>
            <Command.Item value="import questions csv json bulk" onSelect={() => go("/app/questions?import=1")} className={itemCls}>
              <ArrowRight className="rtl:rotate-180" /> {t("cmd.importQuestions")}
            </Command.Item>
          </Command.Group>
        )}

        <Command.Group heading={t("cmd.preferences")} className={groupCls}>
          <Command.Item
            value="theme dark light appearance"
            onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
            className={itemCls}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            {resolvedTheme === "dark" ? t("account.light") : t("account.dark")}
          </Command.Item>
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
