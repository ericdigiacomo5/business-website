'use client'

import { useState } from "react"
import type { Availability } from "@/generated/prisma/client"
import { Button } from "@/components/ui/button"
import { AdminAvailabilityRow } from "./admin-availability-row"
import { AvailabilityForm, type AvailabilityFormValues } from "./availability-form"

// VISUAL SCAFFOLD — the handlers below are stubs. UI state (which form is
// open, which row is being edited) is real; persistence is not wired up yet.
export function AdminAvailabilityManager({
    artistId,
    initialWindows,
}: {
    artistId: string
    initialWindows: Availability[]
}) {
    const [error, setError] = useState<string | null>(null)
    const [windows, setWindows] = useState<Availability[] | null>(initialWindows)
    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    async function handleCreate(values: AvailabilityFormValues) {
        setError(null)

        try {
            const res = await fetch("/api/admin/availability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ artistId, ...values }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't add availability. Please try again.")
                return
            }

            const body = await res.json()
            setWindows((prev) => [...(prev ?? []), body.data])
            setIsCreating(false)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    async function handleSaveEdit(id: string, values: AvailabilityFormValues) {
        setError(null)

        try {
            const res = await fetch(`/api/admin/availability/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't edit availability. Please try again.")
                return
            }

            const body = await res.json()
            setWindows((prev) => (prev ?? []).map((w) => (w.id === id ? body.data : w)))
            setEditingId(null)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    async function handleDelete(id: string) {
        setError(null)

        try {
            const res = await fetch(`/api/admin/availability/${id}`, {
                method: "DELETE",
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't delete availability. Please try again.")
                return
            }

            setWindows((prev) => (prev ?? []).filter((w) => w.id !== id))
        } catch {
            setError("Network error. Please try again.")
        }
    }

    return (
        <div>
            <div className="mt-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Availability</h2>
                {!isCreating && (
                    <Button size="md" onClick={() => setIsCreating(true)}>
                        New Window
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
                    <AvailabilityForm
                        submitLabel="Create Window"
                        onSubmit={handleCreate}
                        onCancel={() => setIsCreating(false)}
                    />
                </div>
            )}

            {!windows || windows.length === 0 ? (
                <p className="mt-8 text-muted-foreground">No availability windows set for this artist yet.</p>
            ) : (
                <div className="mt-6 flex flex-col gap-3">
                    {windows.map((availability) => (
                        <AdminAvailabilityRow
                            key={availability.id}
                            availability={availability}
                            isEditing={editingId === availability.id}
                            onEdit={() => setEditingId(availability.id)}
                            onCancelEdit={() => setEditingId(null)}
                            onSave={(values) => handleSaveEdit(availability.id, values)}
                            onDelete={() => handleDelete(availability.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}