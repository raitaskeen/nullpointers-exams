"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js in production only (a service worker in dev fights hot reload). The worker
 * never caches API responses - it only serves the branded offline page when a navigation can't load.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
