"use client";

import { notFound, useParams } from "next/navigation";
import { getResource } from "@np/shared";
import { RequirePermission } from "@/lib/route-guards";
import { ResourceFormPage } from "./ResourceFormPage";
import { ResourceListPage } from "./ResourceListPage";
import { Suspense } from "react";

/**
 * /app/<resource>, /app/<resource>/new and /app/<resource>/<id> for every resource in @np/shared.
 * To give a resource a custom screen, create app/app/<name>/page.tsx - a static route wins over this one.
 */
export function ResourceRoute({ mode }: { mode: "list" | "new" | "edit" }) {
  const params = useParams<{ resource: string; id?: string }>();
  const def = getResource(params.resource);
  if (!def) notFound();

  if (mode === "list") {
    return (
      <RequirePermission permission={`${def.name}:read`}>
        <Suspense>
          <ResourceListPage def={def} />
        </Suspense>
      </RequirePermission>
    );
  }
  const id = mode === "edit" ? Number(params.id) : null;
  if (mode === "edit" && (!Number.isSafeInteger(id) || (id ?? 0) <= 0)) notFound();
  return (
    <RequirePermission permission={`${def.name}:${mode === "new" ? "create" : "update"}`}>
      <ResourceFormPage key={`${def.name}-${id}`} def={def} id={id} />
    </RequirePermission>
  );
}
