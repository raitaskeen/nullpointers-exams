"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Light by default: judges see the app on a projector, where dark UIs wash out. Dark is fully designed
 * and one keystroke away (⌘K -> Appearance). The choice persists per browser.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}

export { useTheme } from "next-themes";
