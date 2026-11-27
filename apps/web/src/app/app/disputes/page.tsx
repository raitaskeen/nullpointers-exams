import { Suspense } from "react";
import type { Metadata } from "next";
import { DisputesPage } from "@/features/results/DisputesPage";
import { LoadingRows } from "@/components/feedback/States";
import { RequirePermission } from "@/lib/route-guards";

export const metadata: Metadata = { title: "Disputes" };

export default function Page() {
  return (
    <RequirePermission permission="exams:manage">
      <Suspense fallback={<LoadingRows rows={4} />}>
        <DisputesPage />
      </Suspense>
    </RequirePermission>
  );
}
