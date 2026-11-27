"use client";

import { useState, type ReactNode } from "react";
import { IconContext } from "@phosphor-icons/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { AuthProvider } from "@/lib/auth-context";
import { LocaleProvider } from "@/lib/i18n";
import { PaletteProvider } from "@/lib/palette";
import { ThemeProvider } from "@/lib/theme-provider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkStatus } from "@/components/feedback/NetworkStatus";
import { ServiceWorker } from "@/components/ServiceWorker";
import { Toaster } from "@/components/ui/sonner";

const iconDefaults = { weight: "regular" as const, mirrored: false };

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            // Don't retry requests that can't succeed (401/403/404/422).
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PaletteProvider>
          <LocaleProvider>
            <IconContext.Provider value={iconDefaults}>
              <QueryClientProvider client={queryClient}>
                <AuthProvider>
                  {children}
                  <NetworkStatus />
                  <Toaster position="bottom-right" />
                  <ServiceWorker />
                </AuthProvider>
              </QueryClientProvider>
            </IconContext.Provider>
          </LocaleProvider>
        </PaletteProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
