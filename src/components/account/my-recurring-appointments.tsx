'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    RecurringSeriesRow,
    type RecurringAppointmentWithRelations,
} from "@/components/recurring/recurring-series-row"

export function MyRecurringAppointments() {
    const router = useRouter()
    const [series, setSeries] = useState<RecurringAppointmentWithRelations[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [confirmingId, setConfirmingId] = useState<string | null>(null)

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

    // Cancelling is the only thing a standing appointment supports as a
    // whole; single visits are cancelled from the bookings list above.
    async function handleCancel(id: string) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/recurring-appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "CANCELLED" }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't cancel that series. Please try again.")
                return
            }

            const body = await res.json()
            setSeries((prev) =>
                prev
                    ? prev.map((s) => (s.id === id ? { ...s, ...body.data.recurringAppointment } : s))
                    : prev
            )
            setConfirmingId(null)
            // Cancelling frees the series' upcoming weeks — re-render the
            // server-side bookings list above so it reflects that without a
            // manual reload (see the key on MyBookingsList in
            // app/appointments/page.tsx).
            router.refresh()
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
            <h2 className="font-serif text-2xl font-extrabold text-foreground">
                Standing Appointments
            </h2>

            {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                    {error}
                </p>
            )}

            <div className="mt-5 flex flex-col gap-4">
                {series.map((s) => (
                    <RecurringSeriesRow
                        key={s.id}
                        series={s}
                        showCustomer={false}
                        busy={busyId === s.id}
                        confirming={confirmingId === s.id}
                        onCancel={() => setConfirmingId(s.id)}
                        onConfirm={() => handleCancel(s.id)}
                        onConfirmBack={() => setConfirmingId(null)}
                    />
                ))}
            </div>
        </section>
    )
}
