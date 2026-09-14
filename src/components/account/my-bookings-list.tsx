'use client'

import { useState } from "react"
import { AppointmentCard, type AppointmentWithRelations } from "./appointment-card"

function isCancellable(appointment: AppointmentWithRelations) {
    const isActive = appointment.status === "UPCOMING" || appointment.status === "CONFIRMED"
    const isFuture = new Date(appointment.startTime).getTime() > Date.now()
    // The DELETE route itself doesn't block cancelling a past/inactive
    // appointment — this is a frontend-only UX guard, not a security boundary.
    return isActive && isFuture
}

export function MyBookingsList({ initialAppointments }: { initialAppointments: AppointmentWithRelations[] }) {
    const [appointments, setAppointments] = useState(initialAppointments)
    const [cancellingId, setCancellingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleCancel(id: string) {
        setError(null)
        setCancellingId(id)

        try {
            const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't cancel that booking. Please try again.")
                return
            }

            const body = await res.json()
            setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: body.data.status } : a)))
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setCancellingId(null)
        }
    }

    if (appointments.length === 0) {
        return <p className="mt-8 text-muted-foreground">You don&apos;t have any bookings yet.</p>
    }

    const upcoming = appointments.filter(isCancellable)
    const other = appointments.filter((a) => !isCancellable(a))

    return (
        <div className="mt-8 flex flex-col gap-10">
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}

            {upcoming.length > 0 && (
                <section>
                    <h2 className="border-b-2 border-foreground pb-2.5 font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Upcoming
                    </h2>
                    <div className="mt-5 flex flex-col gap-4">
                        {upcoming.map((appointment) => (
                            <AppointmentCard
                                key={appointment.id}
                                appointment={appointment}
                                cancellable
                                cancelling={cancellingId === appointment.id}
                                onCancel={() => handleCancel(appointment.id)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {other.length > 0 && (
                <section>
                    <h2 className="border-b-2 border-foreground pb-2.5 font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Past &amp; Cancelled
                    </h2>
                    <div className="mt-5 flex flex-col gap-4">
                        {other.map((appointment) => (
                            <AppointmentCard
                                key={appointment.id}
                                appointment={appointment}
                                cancellable={false}
                                cancelling={false}
                                onCancel={() => { }}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}
