"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Lightweight i18n for the product chrome (navigation, actions, states, assistant). English + Urdu (RTL).
 * Domain labels come from resource definitions; validation messages from the shared schemas.
 * Add a language: add a dictionary below with the same keys + an entry in LOCALES.
 */

const en = {
  "nav.overview": "Overview",
  "nav.workspace": "Workspace",
  "nav.admin": "Admin",
  "nav.users": "People",
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

const ur: Record<MessageKey, string> = {
  "nav.overview": "جائزہ",
  "nav.workspace": "ورک اسپیس",
  "nav.admin": "ایڈمن",
  "nav.users": "افراد",
  "nav.viewSite": "عوامی سائٹ",
  "nav.search": "تلاش کریں یا کہیں جائیں…",
  "nav.openMenu": "مینو کھولیں",
  "nav.closeMenu": "مینو بند کریں",
  "account.menu": "اکاؤنٹ مینو",
  "account.logout": "لاگ آؤٹ",
  "account.logoutAll": "ہر جگہ سے لاگ آؤٹ",
  "account.admin": "منتظم",
  "account.member": "رکن",
  "account.theme": "ظاہری شکل",
  "account.light": "روشن",
  "account.dark": "تاریک",
  "account.language": "زبان",
  "account.palette": "برانڈ کا رنگ",
  "common.new": "نیا",
  "common.save": "تبدیلیاں محفوظ کریں",
  "common.create": "بنائیں",
  "common.cancel": "منسوخ",
  "common.delete": "حذف کریں",
  "common.edit": "ترمیم",
  "common.retry": "دوبارہ کوشش کریں",
  "common.close": "بند کریں",
  "common.all": "سب",
  "common.yes": "ہاں",
  "common.no": "نہیں",
  "common.open": "کھولیں",
  "list.live": "لائیو",
  "list.connecting": "جڑ رہا ہے",
  "list.search": "{plural} میں تلاش کریں",
  "list.empty": "ابھی کوئی {plural} نہیں",
  "list.emptyHint": "پہلا بنائیں، یہ فوراً سب کو یہاں نظر آئے گا۔",
  "list.noMatch": "کچھ نہیں ملا",
  "list.noMatchHint": "کوئی اور تلاش آزمائیں یا فلٹر صاف کریں۔",
  "list.clear": "فلٹر صاف کریں",
  "list.showing": "{total} میں سے {from}–{to}",
  "list.rows": "فی صفحہ قطاریں",
  "list.prev": "پچھلا صفحہ",
  "list.next": "اگلا صفحہ",
  "list.page": "صفحہ {page}",
  "list.deleteTitle": "یہ {singular} حذف کریں؟",
  "list.deleteBody": "یہ سب کے لیے مستقل طور پر ہٹ جائے گا۔ اسے واپس نہیں لایا جا سکتا۔",
  "list.details": "تفصیلات",
  "list.created": "بنایا گیا",
  "list.updated": "اپ ڈیٹ ہوا",
  "form.new": "نیا {singular}",
  "form.edit": "{singular} میں ترمیم",
  "form.choose": "{label} منتخب کریں",
  "form.saving": "محفوظ ہو رہا ہے…",
  "dash.morning": "صبح بخیر",
  "dash.afternoon": "سہ پہر بخیر",
  "dash.evening": "شام بخیر",
  "dash.subtitle": "آپ کی ورک اسپیس میں یہ چل رہا ہے۔",
  "dash.activity": "حالیہ سرگرمی",
  "dash.activityEmpty": "ٹیم کے کام کے ساتھ سرگرمی یہاں نظر آئے گی۔",
  "dash.trend": "پچھلے 14 دنوں میں نئے",
  "dash.breakdown": "{field} کے لحاظ سے",
  "dash.total": "کل",
  "dash.week": "اس ہفتے +{n}",
  "dash.quick": "فوری اقدامات",
  "cmd.placeholder": "کمانڈ لکھیں یا تلاش کریں…",
  "cmd.navigate": "جائیں",
  "cmd.create": "بنائیں",
  "cmd.preferences": "ترجیحات",
  "cmd.ask": "معاون سے پوچھیں",
  "cmd.empty": "کوئی نتیجہ نہیں۔",
  "ai.title": "معاون",
  "ai.subtitle": "آپ کے لائیو ڈیٹا سے جوابات، آپ کی اجازت کے اندر۔",
  "ai.placeholder": "اپنی ورک اسپیس کے بارے میں کچھ بھی پوچھیں…",
  "ai.send": "بھیجیں",
  "ai.stop": "روکیں",
  "ai.new": "نئی گفتگو",
  "ai.thinking": "سوچ رہا ہے",
  "ai.lookedUp": "{what} دیکھا",
  "ai.notConfigured": "معاون ابھی ترتیب نہیں دیا گیا۔ اسے چالو کرنے کے لیے API میں GROQ_API_KEY شامل کریں۔",
  "ai.error": "معاون جواب نہیں دے سکا۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔",
  "ai.disclaimer": "AI غلطی کر سکتا ہے۔ اہم تفصیلات کی تصدیق کریں۔",
  "offline.banner": "آپ آف لائن ہیں۔ ہم خود بخود دوبارہ جڑ جائیں گے۔",
  "offline.back": "دوبارہ آن لائن",
  "error.title": "اس اسکرین پر کچھ خراب ہو گیا",
  "error.body": "یہ ریکارڈ ہو گیا ہے۔ ری لوڈ کرنے سے عموماً ٹھیک ہو جاتا ہے۔",
  "error.reload": "ری لوڈ کریں",
  "notFound.title": "یہ صفحہ موجود نہیں",
  "notFound.body": "لنک پرانا ہو سکتا ہے یا صفحہ منتقل ہو گیا ہے۔ باقی سب اپنی جگہ پر ہے۔",
  "notFound.home": "ہوم پر واپس",
  "notFound.app": "ایپ کھولیں",
};

export const LOCALES = [
  { id: "en", label: "English", dir: "ltr", intl: "en-US" },
  { id: "ur", label: "اردو", dir: "rtl", intl: "ur-PK" },
] as const;
export type Locale = (typeof LOCALES)[number]["id"];

const DICTS: Record<Locale, Record<MessageKey, string>> = { en, ur };
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
      if (saved === "en" || saved === "ur") set(saved);
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
