import { Suspense } from "react";
import type { Metadata } from "next";
import { VerifyPage } from "@/features/results/VerifyPage";

export const metadata: Metadata = { title: "Verify a result" };

export default function Page() {
  return (
    <Suspense>
      <VerifyPage />
    </Suspense>
  );
}
