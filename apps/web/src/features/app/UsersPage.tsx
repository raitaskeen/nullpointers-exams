"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ROLES, type AuthUser, type Page } from "@np/shared";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { api, apiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type UserRow = Omit<AuthUser, "permissions">;
const PAGE_SIZE = 20;

/** Admin user management: change a role or deactivate an account (which ends their sessions immediately). */
export function UsersPage() {
  const { user: me, can } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const canManage = can("users:manage");

  const list = useQuery({
    queryKey: ["users", page],
    queryFn: () => api<Page<UserRow>>(`/users?page=${page}&pageSize=${PAGE_SIZE}`),
    placeholderData: keepPreviousData,
  });

  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: number; roles?: string[]; isActive?: boolean }) =>
      api<UserRow>(`/users/${id}`, { method: "PATCH", json: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const columns: DataColumn<UserRow>[] = [
    {
      id: "name",
      header: "User",
      cell: (u) => (
        <div>
          <div className="font-medium">{u.fullName}</div>
          <div className="text-xs break-all text-muted-foreground">{u.email}</div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: (u) =>
        canManage && u.id !== me?.id ? (
          <NativeSelect
            aria-label={`Role for ${u.email}`}
            value={u.roles[0] ?? "user"}
            onChange={(e) => update.mutate({ id: u.id, roles: [e.target.value] })}
            className="w-32"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <StatusBadge tone="info">{u.roles.join(", ")}</StatusBadge>
        ),
    },
    {
      id: "status",
      header: "Status",
      hideBelow: "sm",
      cell: (u) => (u.isActive ? <StatusBadge tone="success">Active</StatusBadge> : <StatusBadge tone="danger">Deactivated</StatusBadge>),
    },
  ];
  if (canManage) {
    columns.push({
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (u) =>
        u.id === me?.id ? (
          <span className="text-xs text-muted-foreground">You</span>
        ) : (
          <Button variant="outline" size="sm" onClick={() => update.mutate({ id: u.id, isActive: !u.isActive })}>
            {u.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        ),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Everyone with an account. Deactivating someone signs them out everywhere, instantly." />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        getRowId={(u) => u.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        caption="Users"
        serverPagination={{ page, pageSize: PAGE_SIZE, total: list.data?.total ?? 0, onPageChange: setPage }}
      />
    </div>
  );
}
