import { Suspense } from "react";
import type { Metadata } from "next";
import { ResultDetailPage } from "@/features/results/ResultDetailPage";
import { LoadingRows } from "@/components/feedback/States";

export const metadata: Metadata = { title: "Result" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <ResultDetailPage />
    </Suspense>
  );
}
