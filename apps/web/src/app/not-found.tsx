"use client";

import Link from "next/link";
import { ArrowLeft, SquaresFour } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/features/home/StatusPage";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <StatusPage
      code="404"
      title={t("notFound.title")}
      body={t("notFound.body")}
      actions={
        <>
          <Button size="lg" variant="outline" render={<Link href="/" />}>
            <ArrowLeft className="rtl:rotate-180" /> {t("notFound.home")}
          </Button>
          {user && (
            <Button size="lg" render={<Link href="/app" />}>
              <SquaresFour /> {t("notFound.app")}
            </Button>
          )}
        </>
      }
    />
  );
}
