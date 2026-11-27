"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Lightweight i18n for the product chrome. English only today; every string is keyed so a language can be added.
 * Domain labels come from resource definitions; validation messages from the shared schemas.
 * Add a language: add a dictionary below with the same keys + an entry in LOCALES.
 */

const en = {
  "nav.overview": "Overview",
  "nav.workspace": "Workspace",
  "nav.admin": "Admin",
  "nav.users": "People",
  "nav.exams": "Exams",
  "nav.questions": "Question bank",
  "nav.disputes": "Disputes",
  "nav.results": "My results",
  "account.examiner": "Examiner",
  "account.candidate": "Candidate",
  "cmd.verify": "Verify a result",
  "cmd.newExam": "New exam",
  "cmd.newQuestion": "New question",
  "cmd.importQuestions": "Import questions",
  "dash.myExams": "My exams",
  "nav.viewSite": "Public site",
  "nav.search": "Search or jump to…",
  "nav.openMenu": "Open navigation",
  "nav.closeMenu": "Close navigation",
  "account.menu": "Account menu",
  "account.logout": "Log out",
  "account.logoutAll": "Log out everywhere",
  "account.admin": "Administrator",
  "account.member": "Member",
  "account.theme": "Appearance",
  "account.light": "Light",
  "account.dark": "Dark",
  "account.language": "Language",
  "account.palette": "Brand color",
  "common.new": "New",
  "common.save": "Save changes",
  "common.create": "Create",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.retry": "Try again",
  "common.close": "Close",
  "common.all": "All",
  "common.yes": "Yes",
  "common.no": "No",
  "common.open": "Open",
  "list.live": "Live",
  "list.connecting": "Connecting",
  "list.search": "Search {plural}",
  "list.empty": "No {plural} yet",
  "list.emptyHint": "Create the first one and it shows up here for everyone instantly.",
  "list.noMatch": "Nothing matches",
  "list.noMatchHint": "Try a different search, or clear the filters.",
  "list.clear": "Clear filters",
  "list.showing": "{from}–{to} of {total}",
  "list.rows": "Rows per page",
  "list.prev": "Previous page",
  "list.next": "Next page",
  "list.page": "Page {page}",
  "list.deleteTitle": "Delete this {singular}?",
  "list.deleteBody": "This permanently removes it for everyone. This can't be undone.",
  "list.details": "Details",
  "list.created": "Created",
  "list.updated": "Updated",
  "form.new": "New {singular}",
  "form.edit": "Edit {singular}",
  "form.choose": "Choose {label}",
  "form.saving": "Saving…",
  "dash.morning": "Good morning",
  "dash.afternoon": "Good afternoon",
  "dash.evening": "Good evening",
  "dash.subtitle": "Here's what's moving in your workspace.",
  "dash.activity": "Recent activity",
  "dash.activityEmpty": "Activity appears here as your team works.",
  "dash.trend": "New in the last 14 days",
  "dash.breakdown": "By {field}",
  "dash.total": "Total",
  "dash.week": "+{n} this week",
  "dash.quick": "Quick actions",
  "cmd.placeholder": "Type a command or search…",
  "cmd.navigate": "Go to",
  "cmd.create": "Create",
  "cmd.preferences": "Preferences",
  "cmd.ask": "Ask the assistant",
  "cmd.empty": "No results.",
  "ai.title": "Assistant",
  "ai.subtitle": "Answers from your live data, within your permissions.",
  "ai.placeholder": "Ask anything about your workspace…",
  "ai.send": "Send",
  "ai.stop": "Stop",
  "ai.new": "New chat",
  "ai.thinking": "Thinking",
  "ai.lookedUp": "Looked up {what}",
  "ai.notConfigured": "The assistant isn't configured yet. Add GROQ_API_KEY to the API to turn it on.",
  "ai.error": "The assistant couldn't answer. Try again in a moment.",
  "ai.disclaimer": "AI can make mistakes. Check important details.",
  "offline.banner": "You're offline. We'll reconnect automatically.",
  "offline.back": "Back online",
  "error.title": "Something broke on this screen",
  "error.body": "It's been logged. Reloading usually fixes it.",
  "error.reload": "Reload",
  "notFound.title": "This page doesn't exist",
  "notFound.body": "The link may be old, or the page moved. Everything else is right where you left it.",
  "notFound.home": "Back to home",
  "notFound.app": "Open the app",
} as const;

export type MessageKey = keyof typeof en;


export const LOCALES = [
  { id: "en", label: "English", dir: "ltr", intl: "en-US" },
] as const;
export type Locale = (typeof LOCALES)[number]["id"];

const DICTS: Record<Locale, Record<MessageKey, string>> = { en };
const KEY = "np-locale";

interface I18n {
  locale: Locale;
  intl: string;
  dir: "ltr" | "rtl";
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, set] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "en") set(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const meta = LOCALES.find((l) => l.id === locale)!;
    document.documentElement.lang = locale;
    document.documentElement.dir = meta.dir;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    set(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const meta = LOCALES.find((l) => l.id === locale)!;
    const dict = DICTS[locale];
    return {
      locale,
      intl: meta.intl,
      dir: meta.dir,
      setLocale,
      t: (key, vars) => {
        let s: string = dict[key] ?? en[key];
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
        return s;
      },
    };
  }, [locale, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within <LocaleProvider>");
  return ctx;
}
