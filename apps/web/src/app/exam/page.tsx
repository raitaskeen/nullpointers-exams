import { Suspense } from "react";
import type { Metadata } from "next";
import { ExamWorkspace } from "@/features/workspace/ExamWorkspace";
import { RequireAuth } from "@/lib/route-guards";

export const metadata: Metadata = { title: "Exam", robots: { index: false } };

export default function Page() {
  return (
    <RequireAuth>
      <Suspense>
        <ExamWorkspace />
      </Suspense>
    </RequireAuth>
  );
}
