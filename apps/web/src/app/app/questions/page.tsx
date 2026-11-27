import { Suspense } from "react";
import type { Metadata } from "next";
import { QuestionBankPage } from "@/features/questions/QuestionBankPage";
import { LoadingRows } from "@/components/feedback/States";
import { RequirePermission } from "@/lib/route-guards";

export const metadata: Metadata = { title: "Question bank" };

export default function Page() {
  return (
    <RequirePermission permission="questions:manage">
      <Suspense fallback={<LoadingRows rows={6} />}>
        <QuestionBankPage />
      </Suspense>
    </RequirePermission>
  );
}
