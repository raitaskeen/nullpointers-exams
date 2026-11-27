"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Page, ResourceDef } from "@np/shared";
import { api, apiErrorMessage } from "@/lib/api-client";

export type Row = Record<string, unknown> & { id: number; createdAt: string; updatedAt: string };

export function useResourceList(def: ResourceDef, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  return useQuery({
    queryKey: ["resource", def.name, "list", qs.toString()],
    queryFn: () => api<Page<Row>>(`/${def.name}?${qs}`),
    placeholderData: keepPreviousData,
  });
}

export function useResourceItem(def: ResourceDef, id: number | null) {
  return useQuery({
    queryKey: ["resource", def.name, "item", id],
    queryFn: () => api<Row>(`/${def.name}/${id}`),
    enabled: id !== null,
  });
}

/** {id,label} list for a referenced resource - powers dropdowns and turns ids into names in tables. */
export function useOptions(name: string | undefined) {
  return useQuery({
    queryKey: ["resource", name, "options"],
    queryFn: () => api<{ id: number; label: string }[]>(`/${name}/options`),
    enabled: !!name,
    staleTime: 30_000,
  });
}

export function useSaveResource(def: ResourceDef, id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      id === null ? api<Row>(`/${def.name}`, { method: "POST", json: values }) : api<Row>(`/${def.name}/${id}`, { method: "PATCH", json: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resource", def.name] });
      toast.success(`${def.singular} ${id === null ? "created" : "saved"}`);
    },
  });
}

export function useDeleteResource(def: ResourceDef) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/${def.name}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resource", def.name] });
      toast.success(`${def.singular} deleted`);
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}
