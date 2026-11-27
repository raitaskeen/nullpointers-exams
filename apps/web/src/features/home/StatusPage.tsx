"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

/**
 * Shared layout for 404 / error screens: brand mark, one large type moment (the code), a plain-language
 * explanation and at most two ways forward. Works without the app shell or a signed-in user.
 */
export function StatusPage({
  code,
  title,
  body,
  actions,
  tone = "neutral",
}: {
  code: string;
  title: string;
  body: string;
  actions: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="Home">
          <Logo />
        </Link>
      </header>
      <main id="main" className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 pb-24 text-center">
        <p
          aria-hidden="true"
          className={cn(
            "font-display text-[clamp(6rem,22vw,11rem)] leading-none font-medium tracking-[-0.05em] select-none animate-rise",
            tone === "danger" ? "text-danger/80" : "text-foreground/15",
          )}
        >
          {code}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{title}</h1>
        <p className="mt-3 max-w-md text-foreground-soft">{body}</p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">{actions}</div>
      </main>
    </div>
  );
}
