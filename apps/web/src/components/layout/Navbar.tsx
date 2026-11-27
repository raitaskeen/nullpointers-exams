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

/** Public navigation: transparent at the top, a hairline + surface once the page scrolls. */
export function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
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
      Open app
      <ArrowRight className="rtl:rotate-180" />
    </Button>
  ) : (
    <>
      <Button variant="ghost" size="sm" render={<Link href="/login" />}>
        Log in
      </Button>
      <Button size="sm" render={<Link href="/register" />}>
        Start free
      </Button>
    </>
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200",
        open
          ? "border-border bg-background" // no backdrop-filter while open: it would trap the fixed menu inside the header
          : scrolled
            ? "border-border bg-background/90 backdrop-blur-md"
            : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label={`${siteConfig.productName} home`}>
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {siteConfig.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-foreground-soft transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 md:flex">
          <Preferences />
          {actions}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <Preferences />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <List />}
          </Button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 top-16 bottom-0 z-40 bg-background px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:hidden animate-[fade-in_160ms_ease-out_backwards]">
          <nav aria-label="Mobile" className="flex flex-col">
            {siteConfig.nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-border py-4 text-lg font-medium"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-6 grid gap-2 [&>*]:w-full">{actions}</div>
        </div>
      )}
    </header>
  );
}
