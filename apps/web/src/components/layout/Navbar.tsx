"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, List, X } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { Preferences } from "@/components/layout/Preferences";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/** Floating glass navigation: a pill that settles onto a frosted surface once the page scrolls. */
export function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const actions = user ? (
    <Button render={<Link href="/app" />} size="sm">
      Open Invigil <ArrowRight className="rtl:rotate-180" />
    </Button>
  ) : (
    <>
      <Button variant="ghost" size="sm" render={<Link href="/login" />}>
        Sign in
      </Button>
      <Button size="sm" render={<Link href="/login" />}>
        Try the demo
      </Button>
    </>
  );

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-2xl border ps-4 pe-2 transition-[background-color,border-color,box-shadow] duration-500 ease-[var(--ease-out)]",
          scrolled || open
            ? "border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-[var(--glass-edge),0_8px_30px_-12px_oklch(0.2_0.02_262/0.22)] backdrop-blur-2xl backdrop-saturate-150"
            : "border-transparent bg-transparent",
        )}
      >
        <Link href="/" className="rounded-md" aria-label={`${siteConfig.productName} home`}>
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground-soft transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 md:flex">
          <Preferences />
          {actions}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <Preferences />
          <Button variant="ghost" size="icon-sm" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((v) => !v)}>
            {open ? <X /> : <List />}
          </Button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="fixed inset-x-3 top-[4.75rem] z-40 rounded-2xl border border-[var(--glass-border)] bg-popover p-4 shadow-lg md:hidden animate-[rise_240ms_var(--ease-out)_backwards]">
          <nav aria-label="Mobile" className="flex flex-col">
            {siteConfig.nav.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="border-b border-border py-3.5 text-base font-medium last:border-0">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 grid gap-2 [&>*]:w-full">{actions}</div>
        </div>
      )}
    </header>
  );
}
