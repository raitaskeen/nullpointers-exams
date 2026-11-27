"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowClockwise, House } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/features/home/StatusPage";
import { useI18n } from "@/lib/i18n";

/** Route-level error boundary: the rest of the app keeps working; this screen offers a retry. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage
      code="500"
      tone="danger"
      title={t("error.title")}
      body={t("error.body")}
      actions={
        <>
          <Button size="lg" variant="outline" render={<Link href="/" />}>
            <House /> {t("notFound.home")}
          </Button>
          <Button size="lg" onClick={reset}>
            <ArrowClockwise /> {t("common.retry")}
          </Button>
        </>
      }
    />
  );
}
