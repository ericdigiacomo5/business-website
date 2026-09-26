'use client'

import { useEffect, useState } from "react"
import { AdminUserRow, type AdminUser } from "./admin-user-row"

// Keyed by debouncedQuery in the parent so a query change remounts this
// component — loading state then comes from useState's initial value, not a
// synchronous setState call inside the effect body. Same pattern as
// UserStep's UserResults in the admin booking wizard (avoids a real
// eslint-plugin-react-hooks set-state-in-effect violation).
function UserResults({ query }: { query: string }) {
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
                <AdminUserRow key={user.id} user={user} />
            ))}
        </div>
    )
}

export function AdminUsersManager() {
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedQuery(query), 300)
        return () => clearTimeout(timeout)
    }, [query])

    return (
        <div>
            <h2 className="text-lg font-semibold text-foreground">Users</h2>

            <input
                type="text"
                placeholder="Search by name, email, or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-4 h-11 w-full rounded-sm border border-border bg-background px-3 text-foreground"
            />

            <UserResults key={debouncedQuery} query={debouncedQuery} />
        </div>
    )
}
