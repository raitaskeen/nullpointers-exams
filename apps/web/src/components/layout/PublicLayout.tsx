"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Navbar } from "@/components/layout/Navbar";
import { siteConfig } from "@/lib/site-config";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-md"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <Link href="/" className="inline-block rounded-md" aria-label={`${siteConfig.productName} home`}>
              <Logo />
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">{siteConfig.tagline}</p>
          </div>
          {siteConfig.footer.map((col) => (
            <div key={col.heading}>
              <p className="text-sm font-semibold">{col.heading}</p>
              <ul className="mt-3 space-y-1">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="inline-flex min-h-10 items-center text-sm text-muted-foreground transition-colors hover:text-foreground pointer-fine:min-h-8">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
            © {new Date().getFullYear()} {siteConfig.productName}. Built for Technoverse 5.0 Web-e-Thon.
          </p>
        </div>
      </footer>
    </div>
  );
}
