import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireGuest } from "@/lib/route-guards";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <Suspense>
      <RequireGuest>
        <LoginPage />
      </RequireGuest>
    </Suspense>
  );
}
