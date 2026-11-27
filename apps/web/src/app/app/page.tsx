import { Suspense } from "react";
import { DashboardPage } from "@/features/app/DashboardPage";
import { LoadingRows } from "@/components/feedback/States";

export default function Page() {
  return (
    <Suspense fallback={<LoadingRows rows={4} />}>
      <DashboardPage />
    </Suspense>
  );
}
