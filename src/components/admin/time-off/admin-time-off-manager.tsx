'use client'

import { useState } from "react"
import type { TimeOff } from "@/generated/prisma/client"
import { Button } from "@/components/ui/button"
import { AdminTimeOffRow } from "./admin-time-off-row"
import { TimeOffForm, type TimeOffFormValues } from "./time-off-form"

export function AdminTimeOffManager({
    artistId,
    initialEntries,
}: {
    // null means salon-wide — this manager is scoped to whichever mode the
    // page is currently viewing, same as before for a concrete artist.
    artistId: string | null
    initialEntries: TimeOff[]
}) {
    const [windows, setWindows] = useState<TimeOff[]>(initialEntries)
    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleCreate(values: TimeOffFormValues) {
        setError(null)

        try {
            const res = await fetch("/api/admin/time-off", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ artistId, ...values })
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't create time off. Please try again.")
                return
            }

            const body = await res.json()
            setWindows((prev) => [...(prev ?? []), body.data])
            setIsCreating(false)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    async function handleSaveEdit(id: string, values: TimeOffFormValues) {

        setError(null)

        try {
            const res = await fetch(`/api/admin/time-off/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't edit time off. Please try again.")
                return
            }

            const body = await res.json()
            setWindows((prev) => prev.map((w) => w.id === id ? body.data : w))
            setEditingId(null)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    async function handleDelete(id: string) {
        setError(null)

        try {
            const res = await fetch(`/api/admin/time-off/${id}`, {
                method: "DELETE"
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't delete time off. Please try again.")
                return
            }

            setWindows((prev) => prev.filter((w) => w.id !== id))
        } catch {
            setError("Network error. Please try again.")
        }
    }

    return (
        <div>
            <div className="mt-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Time Off</h2>
                {!isCreating && (
                    <Button size="md" onClick={() => setIsCreating(true)}>
                        New Time Off
                    </Button>
                )}
            </div>

            {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                    {error}
                </p>
            )}

            {isCreating && (
                <div className="mt-4">
                    <TimeOffForm
                        submitLabel="Create Time Off"
                        onSubmit={handleCreate}
                        onCancel={() => setIsCreating(false)}
                    />
                </div>
            )}

            {windows && windows.length === 0 ? (
                <p className="mt-8 text-muted-foreground">No time off scheduled for this artist.</p>
            ) : (
                <div className="mt-6 flex flex-col gap-3">
                    {windows.map((timeOff) => (
                        <AdminTimeOffRow
                            key={timeOff.id}
                            timeOff={timeOff}
                            isEditing={editingId === timeOff.id}
                            onEdit={() => setEditingId(timeOff.id)}
                            onCancelEdit={() => setEditingId(null)}
                            onSave={(values) => handleSaveEdit(timeOff.id, values)}
                            onDelete={() => handleDelete(timeOff.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}