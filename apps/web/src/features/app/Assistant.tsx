"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowsClockwise, MagnifyingGlass, Sparkle, Stop, X } from "@phosphor-icons/react";
import { allResources } from "@np/shared";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useShell } from "./shell-context";

interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  error?: boolean;
}

/* ---- Minimal, safe markdown: paragraphs, lists, **bold**, `code`, [links](...). No HTML is ever injected. */
function inline(text: string, onNavigate: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={i++} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={i++} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else {
      const [, label, href] = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      if (href!.startsWith("/")) {
        out.push(
          <Link key={i++} href={href!} onClick={onNavigate} className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
            {label}
          </Link>,
        );
      } else if (/^https?:\/\//.test(href!)) {
        out.push(<a key={i++} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{label}</a>);
      } else out.push(label);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={cn("my-2 space-y-1 ps-5", list.ordered ? "list-decimal" : "list-disc", "marker:text-muted-foreground")}>
        {list.items.map((it, j) => <li key={j}>{inline(it, onNavigate)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((ul ?? ol)![1]!);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      h ? <p key={blocks.length} className="mt-3 mb-1 font-semibold text-foreground">{inline(h[1]!, onNavigate)}</p> : <p key={blocks.length} className="my-1.5">{inline(line.replace(/^>\s?/, ""), onNavigate)}</p>,
    );
  }
  flush();
  return <>{blocks}</>;
}

/* ---- SSE over fetch (POST bodies can't use EventSource). */
async function streamChat(
  messages: { role: string; content: string }[],
  signal: AbortSignal,
  on: { delta: (t: string) => void; tool: (label: string) => void; error: (m: string) => void },
) {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = "";
    try {
      message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
    } catch {
      // ignore
    }
    on.error(message || `Request failed (${res.status})`);
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const event = frame.match(/^event: (.+)$/m)?.[1];
      const data = frame.match(/^data: (.+)$/m)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data) as { text?: string; label?: string; message?: string };
      if (event === "delta" && payload.text) on.delta(payload.text);
      else if (event === "tool") on.tool(payload.label ?? "data");
      else if (event === "error") on.error(payload.message ?? "");
    }
  }
}

export function Assistant() {
  const { assistantOpen: open, closeAssistant, consumeQuestion, pendingQuestion } = useShell();
  const { t } = useI18n();
  const { user, can } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const status = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => api<{ enabled: boolean; model: string }>("/ai/status"),
    enabled: open && !!user,
    staleTime: 60_000,
  });

  const suggestions = useMemo(() => {
    const readable = allResources().filter((r) => can(`${r.name}:read`));
    const out: string[] = [];
    for (const r of readable.slice(0, 2)) {
      const en = Object.entries(r.fields).find(([, f]) => f.type === "enum");
      out.push(en ? `How many ${r.plural.toLowerCase()} are there by ${en[1].label.toLowerCase()}?` : `How many ${r.plural.toLowerCase()} are there?`);
      out.push(`Show the 5 newest ${r.plural.toLowerCase()}`);
    }
    return out.slice(0, 4);
  }, [can]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAssistant();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeAssistant]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history = [...messages.filter((m) => !m.error), { role: "user" as const, content }];
    setMessages([...history, { role: "assistant", content: "", tools: [] }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const patch = (fn: (m: Msg) => Msg) =>
      setMessages((all) => [...all.slice(0, -1), fn(all[all.length - 1]!)]);
    try {
      await streamChat(
        history.slice(-20).map(({ role, content: c }) => ({ role, content: c })),
        ctrl.signal,
        {
          delta: (d) => patch((m) => ({ ...m, content: m.content + d })),
          tool: (label) => patch((m) => ({ ...m, tools: [...(m.tools ?? []), label] })),
          error: (msg) => patch((m) => ({ ...m, error: true, content: msg || t("ai.error") })),
        },
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") patch((m) => ({ ...m, error: true, content: t("ai.error") }));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  // A question typed into ⌘K ("Ask: …") arrives here.
  useEffect(() => {
    if (open && pendingQuestion && status.data?.enabled) {
      const q = consumeQuestion();
      if (q) void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingQuestion, status.data?.enabled]);

  if (!open) return null;
  const disabled = status.data && !status.data.enabled;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={t("ai.title")}>
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={closeAssistant}
        className="absolute inset-0 hidden bg-[oklch(0.2_0.02_262/0.25)] animate-[fade-in_160ms_ease-out_backwards] sm:block"
      />
      <section
        className={cn(
          "relative flex h-full w-full flex-col bg-popover shadow-lg sm:w-[min(28rem,100%)] sm:border-s sm:border-border-strong",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          "animate-[rise_260ms_var(--ease-out)_backwards]",
        )}
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-ink">
            <Sparkle weight="duotone" className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.9375rem] font-semibold leading-tight">{t("ai.title")}</h2>
            <p className="truncate text-xs text-muted-foreground">{t("ai.subtitle")}</p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon-sm" aria-label={t("ai.new")} title={t("ai.new")} onClick={() => { abort.current?.abort(); setMessages([]); }}>
              <ArrowsClockwise />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label={t("common.close")} onClick={closeAssistant}>
            <X />
          </Button>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-5" aria-live="polite">
          {disabled ? (
            <div className="mx-auto mt-10 max-w-xs text-center text-sm text-muted-foreground">
              <Sparkle weight="duotone" className="mx-auto mb-3 size-8 text-muted-foreground/60" aria-hidden="true" />
              {t("ai.notConfigured")}
            </div>
          ) : messages.length === 0 ? (
            <div className="mt-6">
              <p className="font-display text-2xl leading-snug font-medium tracking-[-0.02em]">
                {user?.fullName ? `Hi ${user.fullName.split(" ")[0]}, ` : ""}what would you like to know?
              </p>
              <ul className="mt-6 space-y-2">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => send(s)}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-surface px-3.5 text-start text-sm text-foreground-soft shadow-xs transition-colors hover:border-border-strong hover:text-foreground"
                    >
                      <MagnifyingGlass className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="space-y-5">
              {messages.map((m, i) => (
                <li key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-primary px-3.5 py-2.5 text-[0.9375rem] text-primary-foreground">{m.content}</div>
                  ) : (
                    <div className="w-full text-[0.9375rem] leading-relaxed text-foreground-soft">
                      {m.tools && m.tools.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {[...new Set(m.tools)].map((label) => (
                            <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                              <MagnifyingGlass className="size-3" aria-hidden="true" />
                              {t("ai.lookedUp", { what: label })}
                            </span>
                          ))}
                        </div>
                      )}
                      {m.error ? (
                        <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{m.content}</p>
                      ) : m.content ? (
                        <Markdown text={m.content} onNavigate={closeAssistant} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <span className="flex gap-1" aria-hidden="true">
                            {[0, 1, 2].map((d) => (
                              <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${d * 120}ms` }} />
                            ))}
                          </span>
                          {t("ai.thinking")}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <form
          className="border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-control-border/70 bg-surface p-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              disabled={!!disabled}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={t("ai.placeholder")}
              aria-label={t("ai.placeholder")}
              maxLength={4000}
              className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
            {busy ? (
              <Button type="button" size="icon-sm" variant="secondary" aria-label={t("ai.stop")} onClick={() => abort.current?.abort()}>
                <Stop weight="fill" />
              </Button>
            ) : (
              <Button type="submit" size="icon-sm" aria-label={t("ai.send")} disabled={!input.trim() || !!disabled}>
                <ArrowUp weight="bold" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("ai.disclaimer")}</p>
        </form>
      </section>
    </div>
  );
}

