import { UsersPage } from "@/features/app/UsersPage";
import { RequirePermission } from "@/lib/route-guards";

export default function Page() {
  return (
    <RequirePermission permission="users:read">
      <UsersPage />
    </RequirePermission>
  );
}
