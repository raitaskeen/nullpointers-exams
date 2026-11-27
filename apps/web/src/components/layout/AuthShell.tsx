"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { Preferences } from "@/components/layout/Preferences";
import { ProductFrame } from "@/features/home/ProductFrame";
import { siteConfig } from "@/lib/site-config";

type AuthShellProps = {
  title: string;
  description: string;
  /** Below the form - usually "Already have an account? Log in". */
  footer: ReactNode;
  children: ReactNode;
};

/**
 * Sign-in/sign-up layout: a calm form column, and (from lg) a brand panel showing the actual product.
 * The form is the only thing on a phone - no scrolling past decoration to reach the fields.
 */
export function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 sm:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="rounded-md" aria-label={`${siteConfig.productName} home`}>
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <Preferences />
            <Link
              href="/"
              className="hidden min-h-10 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
              Back to site
            </Link>
          </div>
        </header>

        <main id="main" className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col justify-center py-10 animate-rise">
          <h1 className="text-[1.875rem] leading-tight font-semibold tracking-[-0.025em]">{title}</h1>
          <p className="mt-2 text-foreground-soft">{description}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-muted-foreground">{footer}</p>
        </main>

        <p className="text-center text-xs text-muted-foreground">
          Protected by secure sessions and rate-limited sign-in.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden border-s border-border bg-surface-sunken lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative max-w-lg">
          <p className="font-display text-[2.5rem] leading-[1.05] font-medium tracking-[-0.025em]">{siteConfig.tagline}</p>
          <ul className="mt-6 space-y-2.5 text-foreground-soft">
            {["Everything your team needs, in one place", "Changes appear for everyone instantly", "Works beautifully on any phone"].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <CheckCircle weight="fill" className="size-[1.125rem] text-primary" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <ProductFrame className="relative mt-12 -me-40 w-[150%] max-w-none origin-top-left scale-[0.82] rtl:origin-top-right" />
      </aside>
    </div>
  );
}

/** Kept so older imports keep working; the new shell lays out its own form spacing. */
export function AuthFormLayout({ children, submit }: { children: ReactNode; submit: ReactNode; actionHint?: string }) {
  return (
    <div className="flex flex-col gap-4">
      {children}
      <div className="pt-2">{submit}</div>
    </div>
  );
}
