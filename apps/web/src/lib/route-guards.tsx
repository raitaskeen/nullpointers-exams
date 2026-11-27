"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NoPermissionState } from "@/components/feedback/States";
import { useAuth } from "./auth-context";

/**
 * Client-side gates for nicer UX. They are NOT the security boundary - every API route checks the
 * session and permission itself, so a user who bypasses these just gets 401/403 from the API.
 */

function FullPageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
      <span className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  );
}

/** Signed-in users only. Sends others to /login?next=<where they were going>. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, user, router, pathname]);

  if (isLoading || !user) return <FullPageSpinner />;
  return <>{children}</>;
}

/** Signed-out visitors only (login/register). A signed-in user goes on to `next` or the app. */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  useEffect(() => {
    if (!isLoading && user) router.replace(next);
  }, [isLoading, user, router, next]);

  if (isLoading || user) return <FullPageSpinner />;
  return <>{children}</>;
}

/** Shows a friendly "no access" state instead of a broken page when a permission is missing. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) return <NoPermissionState />;
  return <>{children}</>;
}

/** Only allow same-site relative redirects - blocks open-redirects like ?next=https://evil.example. */
export function safeNext(next: string | null, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
