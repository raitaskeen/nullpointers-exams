"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface ShellState {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  assistantOpen: boolean;
  /** Open the assistant, optionally sending a first question. */
  openAssistant: (question?: string) => void;
  closeAssistant: () => void;
  pendingQuestion: string | null;
  consumeQuestion: () => string | null;
}

const Ctx = createContext<ShellState | null>(null);

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** App-wide UI state + keyboard shortcuts: ⌘K / Ctrl+K or "/" = command palette, ⌘J / Ctrl+J = assistant. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [pendingQuestion, setPending] = useState<string | null>(null);

  const openAssistant = useCallback((question?: string) => {
    if (question) setPending(question);
    setCommandOpen(false);
    setAssistantOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      } else if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAssistantOpen((o) => !o);
      } else if (e.key === "/" && !isTyping(e.target) && !commandOpen) {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen]);

  return (
    <Ctx.Provider
      value={{
        commandOpen,
        setCommandOpen,
        assistantOpen,
        openAssistant,
        closeAssistant: () => setAssistantOpen(false),
        pendingQuestion,
        consumeQuestion: () => {
          const q = pendingQuestion;
          setPending(null);
          return q;
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useShell() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShell must be used within <ShellProvider>");
  return ctx;
}
