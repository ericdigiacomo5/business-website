'use client'

import { useEffect, useState } from "react"
import type { RecurringStatus } from "@/generated/prisma/client"
import {
    RecurringSeriesRow,
    type RecurringAppointmentWithRelations,
} from "@/components/recurring/recurring-series-row"

// Unlike the appointment-history list on the same page (a direct Prisma
// read in the Server Component), this list is fetched client-side — the
// moment a list needs a local "after I click this button, update in place"
// story, this project's established pattern is Client Component + fetch(),
// same as every other admin CRUD page.
export function AdminRecurringAppointments({ userId }: { userId: string }) {
    const [series, setSeries] = useState<RecurringAppointmentWithRelations[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        fetch(`/api/admin/recurring-appointments?userId=${userId}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load standing appointments")
                return res.json() as Promise<{ data: RecurringAppointmentWithRelations[] }>
            })
            .then((body) => {
                if (!cancelled) setSeries(body.data)
            })
            .catch(() => {
                if (!cancelled) setSeries([])
            })

        return () => {
            cancelled = true
        }
    }, [userId])

    async function handleStatusChange(id: string, status: RecurringStatus) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/admin/recurring-appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't update that series. Please try again.")
                return
            }

            const body = await res.json()
            // Use the server's returned row, don't assume the request
            // succeeded exactly as sent.
            setSeries((prev) =>
                prev
                    ? prev.map((s) => (s.id === id ? { ...s, ...body.data.recurringAppointment } : s))
                    : prev
            )
            setConfirmingCancelId(null)
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    if (series === null) {
        return <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
    }

    return (
        <div>
            {error && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}

            {series.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No standing appointments.</p>
            ) : (
                <div className="mt-3 flex flex-col gap-2">
                    {series.map((s) => (
                        <RecurringSeriesRow
                            key={s.id}
                            series={s}
                            showCustomer={false}
                            busy={busyId === s.id}
                            confirmingCancel={confirmingCancelId === s.id}
                            onPause={() => handleStatusChange(s.id, "PAUSED")}
                            onResume={() => handleStatusChange(s.id, "ACTIVE")}
                            onCancel={() => setConfirmingCancelId(s.id)}
                            onConfirmCancel={() => handleStatusChange(s.id, "CANCELLED")}
                            onCancelBack={() => setConfirmingCancelId(null)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
