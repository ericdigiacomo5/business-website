'use client'

import { useEffect, useState } from "react"
import type { SelectedUser } from "../wizard-state"

type ApiUser = { id: string; name: string | null; email: string; phone: string; role: string }

// Keyed by `debouncedQuery` in the parent so a query change remounts this
// component — loading state then comes from useState's initial value, not a
// synchronous setState call inside the effect body, matching the same
// pattern DateTimeStep's SlotFetcher uses (a real eslint-plugin-react-hooks
// set-state-in-effect violation otherwise).
function UserResults({
    query,
    onSelect,
}: {
    query: string
    onSelect: (user: SelectedUser) => void
}) {
    const [results, setResults] = useState<ApiUser[] | null>(null)

    useEffect(() => {
        let cancelled = false

        fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to search customers")
                return res.json() as Promise<{ data: ApiUser[] }>
            })
            .then((body) => {
                if (!cancelled) setResults(body.data)
            })
            .catch(() => {
                if (!cancelled) setResults([])
            })

        return () => {
            cancelled = true
        }
    }, [query])

    if (results === null) {
        return <p className="text-sm text-muted-foreground">Searching...</p>
    }

    if (results.length === 0) {
        return <p className="text-sm text-muted-foreground">No customers found.</p>
    }

    return (
        <>
            {results.map((user) => (
                <button
                    key={user.id}
                    type="button"
                    onClick={() => onSelect(user)}
                    className="flex min-h-11 flex-col rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:bg-muted"
                >
                    <span className="font-medium text-surface-foreground">{user.name ?? user.email}</span>
                    <span className="mt-1 text-sm text-muted-foreground">
                        {user.email} &middot; {user.phone}
                    </span>
                </button>
            ))}
        </>
    )
}

export function UserStep({ onSelect }: { onSelect: (user: SelectedUser) => void }) {
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const [showCreateForm, setShowCreateForm] = useState(false)

    // Simple debounce — no library, matching this project's no-form-library
    // convention elsewhere (login/register). Only updates debouncedQuery
    // (which remounts UserResults via its key), never fetches directly here.
    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedQuery(query), 300)
        return () => clearTimeout(timeout)
    }, [query])

    return (
        <div>
            <h2 className="text-lg font-semibold text-foreground">Choose a Customer</h2>

            <input
                type="text"
                placeholder="Search by name, email, or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-4 h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground"
            />

            <div className="mt-4 flex flex-col gap-3">
                <UserResults key={debouncedQuery} query={debouncedQuery} onSelect={onSelect} />
            </div>

            <div className="mt-4 rounded-xl border border-border bg-surface p-4">
                {showCreateForm ? (
                    <NewCustomerForm onCreated={onSelect} onCancel={() => setShowCreateForm(false)} />
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowCreateForm(true)}
                        className="min-h-11 w-full text-left text-sm font-medium text-primary"
                    >
                        + Add new customer
                    </button>
                )}
            </div>
        </div>
    )
}

function NewCustomerForm({
    onCreated,
    onCancel,
}: {
    onCreated: (user: SelectedUser) => void
    onCancel: () => void
}) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [phone, setPhone] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setPending(true)

        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, phone }),
            })

            const body = await res.json().catch(() => null)

            if (!res.ok) {
                setError(body?.error ?? "Something went wrong. Please try again.")
                return
            }

            onCreated(body.data as SelectedUser)
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setPending(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
                <label htmlFor="new-customer-name" className="block text-xs font-medium text-muted-foreground">
                    Name
                </label>
                <input
                    id="new-customer-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>
            <div>
                <label htmlFor="new-customer-email" className="block text-xs font-medium text-muted-foreground">
                    Email
                </label>
                <input
                    id="new-customer-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>
            <div>
                <label htmlFor="new-customer-phone" className="block text-xs font-medium text-muted-foreground">
                    Phone
                </label>
                <input
                    id="new-customer-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>

            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={pending}
                    className="min-h-11 flex-1 rounded-lg border border-border text-sm font-medium text-foreground"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={pending}
                    className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                >
                    {pending ? "Creating..." : "Create & Select"}
                </button>
            </div>
        </form>
    )
}
