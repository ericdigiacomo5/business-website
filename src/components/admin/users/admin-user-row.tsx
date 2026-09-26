import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export type AdminUser = {
    id: string
    name: string | null
    email: string
    phone: string
    role: "CUSTOMER" | "ADMIN"
}

export function AdminUserRow({ user }: { user: AdminUser }) {
    return (
        <Link
            href={`/admin/users/${user.id}`}
            className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4 hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
        >
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-foreground">{user.name || "(no name)"}</span>
                    <Badge tone={user.role === "ADMIN" ? "success" : "muted"}>{user.role}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">{user.phone}</p>
            </div>
        </Link>
    )
}
