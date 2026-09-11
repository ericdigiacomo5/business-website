'use client'

import { useEffect, useState } from "react"
import type { ProfileFormValues } from "@/components/account/profile-form"
import { AdminUserRow, type AdminUser } from "./admin-user-row"

// Keyed by debouncedQuery in the parent so a query change remounts this
// component — loading state then comes from useState's initial value, not a
// synchronous setState call inside the effect body. Same pattern as
// UserStep's UserResults in the admin booking wizard (avoids a real
// eslint-plugin-react-hooks set-state-in-effect violation).
function UserResults({
    query,
    editingId,
    onEdit,
    onCancelEdit,
    onSave,
}: {
    query: string
    editingId: string | null
    onEdit: (id: string) => void
    onCancelEdit: () => void
    onSave: (id: string, values: ProfileFormValues) => void
}) {
    const [users, setUsers] = useState<AdminUser[] | null>(null)

    useEffect(() => {
        let cancelled = false

        fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to search users")
                return res.json() as Promise<{ data: AdminUser[] }>
            })
            .then((body) => {
                if (!cancelled) setUsers(body.data)
            })
            .catch(() => {
                if (!cancelled) setUsers([])
            })

        return () => {
            cancelled = true
        }
    }, [query])

    if (users === null) {
        return <p className="mt-6 text-muted-foreground">Searching...</p>
    }

    if (users.length === 0) {
        return <p className="mt-6 text-muted-foreground">No users found.</p>
    }

    return (
        <div className="mt-6 flex flex-col gap-3">
            {users.map((user) => (
                <AdminUserRow
                    key={user.id}
                    user={user}
                    isEditing={editingId === user.id}
                    onEdit={() => onEdit(user.id)}
                    onCancelEdit={onCancelEdit}
                    onSave={(values) => onSave(user.id, values)}
                />
            ))}
        </div>
    )
}

export function AdminUsersManager() {
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    // Bumped after a successful save to force UserResults to refetch (its key
    // is debouncedQuery, which a save doesn't change) so the edited row shows
    // the saved values instead of the pre-edit search results.
    const [refreshToken, setRefreshToken] = useState(0)

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedQuery(query), 300)
        return () => clearTimeout(timeout)
    }, [query])

    async function handleSave(id: string, values: ProfileFormValues) {
        setError(null)

        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't save changes. Please try again.")
                return
            }

            setEditingId(null)
            setRefreshToken((t) => t + 1)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    return (
        <div>
            <h2 className="text-lg font-semibold text-foreground">Users</h2>

            <input
                type="text"
                placeholder="Search by name, email, or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-4 h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground"
            />

            {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                    {error}
                </p>
            )}

            <UserResults
                key={`${debouncedQuery}:${refreshToken}`}
                query={debouncedQuery}
                editingId={editingId}
                onEdit={setEditingId}
                onCancelEdit={() => setEditingId(null)}
                onSave={handleSave}
            />
        </div>
    )
}
