"use client";

import { useEffect, useRef, useState } from "react";
import { WifiSlash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

/** Slim banner while offline; a quiet confirmation when the connection comes back. */
export function NetworkStatus() {
  const { t } = useI18n();
  const [online, setOnline] = useState(true);
  const wasOffline = useRef(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => {
      setOnline(true);
      if (wasOffline.current) toast.success(t("offline.back"));
      wasOffline.current = false;
    };
    const down = () => {
      setOnline(false);
      wasOffline.current = true;
    };
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [t]);

  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-foreground px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm font-medium text-background animate-[rise_300ms_var(--ease-out)_backwards]"
    >
      <WifiSlash className="size-4" aria-hidden="true" />
      {t("offline.banner")}
    </div>
  );
}
