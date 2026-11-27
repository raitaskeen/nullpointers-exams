import { Suspense } from "react";
import type { Metadata } from "next";
import { ResultsPage } from "@/features/results/ResultsPage";
import { LoadingRows } from "@/components/feedback/States";
import { RequirePermission } from "@/lib/route-guards";

export const metadata: Metadata = { title: "My results" };

export default function Page() {
  return (
    <RequirePermission permission="exams:take">
      <Suspense fallback={<LoadingRows rows={4} />}>
        <ResultsPage />
      </Suspense>
    </RequirePermission>
  );
}
