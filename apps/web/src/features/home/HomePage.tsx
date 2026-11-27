"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, Command, MagnifyingGlass, ShieldCheck, Sparkle, TextAa } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";
import { LiveSyncDemo } from "./LiveSyncDemo";
import { ProductFrame } from "./ProductFrame";

const POINT_ICONS = [Command, TextAa, Sparkle];

/** Command palette fragment, drawn with the product's own tokens. */
function PaletteFragment() {
  const items = [
    ["Go to", "Tasks", "G T"],
    ["Go to", "Projects", "G P"],
    ["Create", "New task", "C"],
    ["Ask", "Which tasks are due this week?", "↵"],
  ];
  return (
    <div role="img" aria-label="The command palette, searching for tasks." className="overflow-hidden rounded-2xl border border-border-strong bg-popover shadow-lg">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <MagnifyingGlass className="size-4 text-muted-foreground" />
        <span className="text-sm">tas<span className="ms-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-primary" /></span>
        <span className="kbd ms-auto">esc</span>
      </div>
      <ul className="p-2">
        {items.map(([group, label, key], i) => (
          <li key={label} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${i === 0 ? "bg-muted" : ""}`}>
            <span className="w-14 shrink-0 text-xs text-muted-foreground">{group}</span>
            <span className="flex-1 truncate">{label}</span>
            <span className="kbd">{key}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AuditFragment() {
  const rows = [
    ["Sara R.", "changed status", "Doing → Done", "2m"],
    ["Admin", "deactivated", "guest@team.dev", "9m"],
    ["Ali K.", "created", "Venue walkthrough", "14m"],
    ["System", "blocked sign-in", "5 failed attempts", "1h"],
  ];
  return (
    <div role="img" aria-label="An audit trail listing who changed what, and when." className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-5 py-3 text-sm font-medium text-white/90">Audit trail</div>
      <ul className="divide-y divide-white/10">
        {rows.map(([who, what, obj, when]) => (
          <li key={obj} className="flex items-center gap-3 px-5 py-3 text-sm">
            <span className="w-16 shrink-0 font-medium text-white/90">{who}</span>
            <span className="min-w-0 flex-1 truncate text-white/60">
              {what} <span className="text-white/85">{obj}</span>
            </span>
            <span className="shrink-0 text-xs text-white/65 tabular-nums">{when}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HomePage() {
  const { hero, product, live, security, closing } = siteConfig;

  return (
    <>
      {/* Hero: what it is, for whom, the main action - and the real product, not a mood picture. */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 sm:pt-24 md:pb-24">
          <div className="max-w-3xl animate-rise">
            <h1 className="font-display text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.98] font-medium tracking-[-0.03em]">
              {hero.headline}
              <span className="block text-muted-foreground italic">{hero.headlineSoft}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground-soft sm:text-xl">{hero.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" render={<Link href={hero.primary.href} />}>
                {hero.primary.label}
                <ArrowRight className="rtl:rotate-180" />
              </Button>
              <Button size="lg" variant="outline" render={<Link href={hero.secondary.href} />}>
                {hero.secondary.label}
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {hero.facts.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle weight="fill" className="size-4 text-primary" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <ProductFrame className="mt-14 animate-[rise_700ms_var(--ease-out)_150ms_backwards] sm:mt-16" />
        </div>
      </section>

      {/* Product */}
      <section id="product" className="scroll-mt-20 border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
          <div>
            <h2 className="text-3xl font-semibold sm:text-4xl">{product.headline}</h2>
            <p className="mt-4 max-w-md text-lg text-foreground-soft">{product.description}</p>
            <ul className="mt-10 space-y-7">
              {product.points.map((p, i) => {
                const Icon = POINT_ICONS[i] ?? Sparkle;
                return (
                  <li key={p.title} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
                      <Icon className="size-5" weight="duotone" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-semibold">{p.title}</h3>
                      <p className="mt-1 text-foreground-soft">{p.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <PaletteFragment />
        </div>
      </section>

      {/* Live sync - the single authored motion moment. */}
      <section id="live" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold sm:text-4xl">{live.headline}</h2>
            <p className="mt-4 text-lg text-foreground-soft">{live.description}</p>
          </div>
          <div className="mt-12">
            <LiveSyncDemo />
          </div>
        </div>
      </section>

      {/* Security - inverse band. */}
      <section id="security" className="scroll-mt-20 bg-[oklch(0.17_0.012_262)] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-28">
          <div>
            <ShieldCheck weight="duotone" className="size-9 text-[oklch(0.78_0.12_var(--brand-h))]" aria-hidden="true" />
            <h2 className="mt-5 text-3xl font-semibold sm:text-4xl">{security.headline}</h2>
            <p className="mt-4 max-w-md text-lg text-white/70">{security.description}</p>
            <ul className="mt-10 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {security.items.map((item) => (
                <li key={item} className="flex gap-3 text-[0.9375rem] text-white/85">
                  <CheckCircle weight="fill" className="mt-0.5 size-[1.125rem] shrink-0 text-[oklch(0.78_0.12_var(--brand-h))]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <AuditFragment />
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 md:py-32">
          <h2 className="font-display mx-auto max-w-2xl text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02] font-medium tracking-[-0.025em]">
            {closing.headline}
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-foreground-soft">{closing.description}</p>
          <Button size="lg" className="mt-9" render={<Link href={closing.primary.href} />}>
            {closing.primary.label}
            <ArrowRight className="rtl:rotate-180" />
          </Button>
        </div>
      </section>
    </>
  );
}
