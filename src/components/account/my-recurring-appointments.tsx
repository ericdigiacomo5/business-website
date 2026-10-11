'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { RecurringStatus } from "@/generated/prisma/client"
import {
    RecurringSeriesRow,
    describeResume,
    type RecurringAppointmentWithRelations,
    type SeriesConfirmation,
} from "@/components/recurring/recurring-series-row"

export function MyRecurringAppointments({ canRebook }: { canRebook: boolean }) {
    const router = useRouter()
    const [series, setSeries] = useState<RecurringAppointmentWithRelations[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [confirming, setConfirming] = useState<{ id: string; action: SeriesConfirmation } | null>(null)

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

    async function handleStatusChange(id: string, status: RecurringStatus): Promise<boolean> {
        setError(null)
        setNotice(null)
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
                return false
            }

            const body = await res.json()
            setSeries((prev) =>
                prev
                    ? prev.map((s) => (s.id === id ? { ...s, ...body.data.recurringAppointment } : s))
                    : prev
            )
            setConfirming(null)
            if (body.data.materialization) {
                setNotice(describeResume(body.data.materialization))
            }
            // Pause/cancel free upcoming weeks and resume restores them —
            // re-render the server-side bookings list above so it reflects
            // that without a manual reload (see the key on MyBookingsList in
            // app/appointments/page.tsx).
            router.refresh()
            return true
        } catch {
            setError("Network error. Please try again.")
            return false
        } finally {
            setBusyId(null)
        }
    }

    // "Change time" is cancel + book a new standing appointment (there's no
    // edit). Deep-links the wizard to the same service/artist so only the
    // day/time needs choosing.
    async function handleConfirm(s: RecurringAppointmentWithRelations) {
        const action = confirming?.action
        const ok = await handleStatusChange(s.id, "CANCELLED")
        if (ok && action === "change") {
            router.push(`/book?serviceId=${s.serviceId}&artistId=${s.artistId}`)
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
            {notice && (
                <p role="status" className="mt-3 text-sm text-foreground">
                    {notice}
                </p>
            )}

            <div className="mt-5 flex flex-col gap-4">
                {series.map((s) => (
                    <RecurringSeriesRow
                        key={s.id}
                        series={s}
                        showCustomer={false}
                        busy={busyId === s.id}
                        confirming={confirming?.id === s.id ? confirming.action : null}
                        onPause={() => handleStatusChange(s.id, "PAUSED")}
                        onResume={() => handleStatusChange(s.id, "ACTIVE")}
                        onCancel={() => setConfirming({ id: s.id, action: "cancel" })}
                        // Hidden while online booking is closed: the customer
                        // would cancel their series with no way to rebook it.
                        onChangeTime={canRebook ? () => setConfirming({ id: s.id, action: "change" }) : undefined}
                        onConfirm={() => handleConfirm(s)}
                        onConfirmBack={() => setConfirming(null)}
                    />
                ))}
            </div>
        </section>
    )
}
