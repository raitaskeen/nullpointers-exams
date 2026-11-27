import { Suspense } from "react";
import type { Metadata } from "next";
import { ExamDetailPage } from "@/features/exams/ExamDetailPage";
import { LoadingRows } from "@/components/feedback/States";
import { RequirePermission } from "@/lib/route-guards";

export const metadata: Metadata = { title: "Exam" };

export default function Page() {
  return (
    <RequirePermission permission="exams:manage">
      <Suspense fallback={<LoadingRows rows={6} />}>
        <ExamDetailPage />
      </Suspense>
    </RequirePermission>
  );
}
