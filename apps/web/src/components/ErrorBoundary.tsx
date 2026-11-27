"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

/**
 * App-wide safety net. Before this, any render error (e.g. a Base UI part used outside its required
 * parent) unmounted the whole tree and left a blank page with no way out - not even a way to log out
 * (Junaid, 2026-11-25). Now the user gets a message, a reload, and a log-out that works without React.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center text-foreground">
        <div>
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            This screen hit an unexpected error. Reloading usually fixes it.
          </p>
          {process.env.NODE_ENV !== "production" && (
            <pre className="mx-auto mt-4 max-w-lg overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-destructive">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-transform active:scale-[0.97]"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              // Plain fetch, no React: the session cookie is httpOnly, so only the server can clear it.
              fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" } })
                .catch(() => {})
                .finally(() => window.location.assign("/"));
            }}
            className="rounded-lg bg-muted px-4 py-2 text-sm transition-transform active:scale-[0.97]"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }
}
