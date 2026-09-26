'use client'

import { useEffect, useState } from "react"
import type { RecurringStatus } from "@/generated/prisma/client"
import {
    RecurringSeriesRow,
    type RecurringAppointmentWithRelations,
} from "@/components/recurring/recurring-series-row"

export function MyRecurringAppointments() {
    const [series, setSeries] = useState<RecurringAppointmentWithRelations[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        fetch("/api/recurring-appointments")
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
    }, [])

    async function handleStatusChange(id: string, status: RecurringStatus) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/recurring-appointments/${id}`, {
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

    // Loading and empty states render nothing rather than a placeholder
    // message — unlike the admin views, most customers have zero standing
    // appointments, and a section that only ever says "No standing
    // appointments" on every visit is noise, not information. The section
    // only appears once there's something to show.
    if (series === null || series.length === 0) {
        return null
    }

    return (
        <section className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2.5 font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Standing Appointments
            </h2>

            {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                    {error}
                </p>
            )}

            <div className="mt-5 flex flex-col gap-4">
                {series.map((s) => (
                    <div key={s.id} className="flex flex-col gap-1">
                        <RecurringSeriesRow
                            series={s}
                            showCustomer={false}
                            // See RecurringSeriesRow's own doc comment on
                            // allowResume: resuming doesn't re-materialize
                            // anything until a still-unbuilt rolling job
                            // exists, which is fine for an admin who has
                            // PLAN_RECURRING_MANAGEMENT.md for context but
                            // would look broken to a customer.
                            allowResume={false}
                            busy={busyId === s.id}
                            confirmingCancel={confirmingCancelId === s.id}
                            onPause={() => handleStatusChange(s.id, "PAUSED")}
                            onResume={() => handleStatusChange(s.id, "ACTIVE")}
                            onCancel={() => setConfirmingCancelId(s.id)}
                            onConfirmCancel={() => handleStatusChange(s.id, "CANCELLED")}
                            onCancelBack={() => setConfirmingCancelId(null)}
                        />
                        {s.status === "PAUSED" && (
                            <p className="pl-1 text-xs text-muted-foreground">
                                Paused. Contact the salon to resume this standing appointment.
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}
