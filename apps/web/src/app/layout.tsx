import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { bootScript } from "@/lib/boot-script";
import { siteConfig } from "@/lib/site-config";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${siteConfig.productName} - ${siteConfig.tagline}`, template: `%s · ${siteConfig.productName}` },
  description: siteConfig.hero.description,
  applicationName: siteConfig.productName,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
  openGraph: { title: siteConfig.productName, description: siteConfig.tagline, type: "website" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#121318" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes and the palette/locale scripts set attributes before hydration, so they differ on purpose.
    <html lang="en" dir="ltr" data-palette={siteConfig.brand.palette} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
