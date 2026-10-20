import { AdminUsersManager } from "@/components/admin/users/admin-users-manager"
import { requireAdminPage } from "@/lib/require-admin-page"

// No data is read here (the manager searches via /api/admin/users), but the
// guard goes on every admin page anyway, so admin-pages.test.ts can enforce
// one simple rule.
export default async function AdminUsersPage() {
    await requireAdminPage("/admin/users")

    return <AdminUsersManager />
}
