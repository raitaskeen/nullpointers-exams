import { Suspense } from "react";
import type { Metadata } from "next";
import { ExamsPage } from "@/features/exams/ExamsPage";
import { LoadingRows } from "@/components/feedback/States";
import { RequirePermission } from "@/lib/route-guards";

export const metadata: Metadata = { title: "Exams" };

export default function Page() {
  return (
    <RequirePermission permission="exams:manage">
      <Suspense fallback={<LoadingRows rows={5} />}>
        <ExamsPage />
      </Suspense>
    </RequirePermission>
  );
}
