import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { RequireGuest } from "@/lib/route-guards";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return (
    <Suspense>
      <RequireGuest>
        <RegisterPage />
      </RequireGuest>
    </Suspense>
  );
}
