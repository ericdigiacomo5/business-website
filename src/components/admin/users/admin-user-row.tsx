import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProfileForm, type ProfileFormValues } from "@/components/account/profile-form"

export type AdminUser = {
    id: string
    name: string | null
    email: string
    phone: string
    role: "CUSTOMER" | "ADMIN"
}

export function AdminUserRow({
    user,
    isEditing,
    onEdit,
    onCancelEdit,
    onSave,
}: {
    user: AdminUser
    isEditing: boolean
    onEdit: () => void
    onCancelEdit: () => void
    onSave: (values: ProfileFormValues) => void
}) {
    if (isEditing) {
        return (
            <ProfileForm
                submitLabel="Save Changes"
                initial={{ name: user.name ?? "", email: user.email, phone: user.phone }}
                onSubmit={onSave}
                onCancel={onCancelEdit}
            />
        )
    }

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-foreground">{user.name || "(no name)"}</span>
                    <Badge tone={user.role === "ADMIN" ? "success" : "muted"}>{user.role}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">{user.phone}</p>
            </div>

            <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="md" onClick={onEdit}>
                    Edit
                </Button>
            </div>
        </div>
    )
}
