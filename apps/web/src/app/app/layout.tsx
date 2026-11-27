import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/features/app/AppShell";
import { RequireAuth } from "@/lib/route-guards";

export const metadata: Metadata = { title: "App", robots: { index: false } };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
