'use client'

import { useState } from "react"
import { AdminAppointmentRow, type AdminAppointment } from "./admin-appointment-row"
import type { AppointmentStatus } from "@/generated/prisma/client"

export function AdminBookingsList({ initialAppointments }: { initialAppointments: AdminAppointment[] }) {
    const [appointments, setAppointments] = useState(initialAppointments)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function updateStatus(id: string, status: AppointmentStatus) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/admin/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't update that booking. Please try again.")
                return
            }

            const body = await res.json()
            setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: body.data.status } : a)))
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    if (appointments.length === 0) {
        return <p className="mt-8 text-muted-foreground">No bookings match these filters.</p>
    }

    return (
        <div className="mt-6 flex flex-col gap-3">
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            {appointments.map((appointment) => (
                <AdminAppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    busy={busyId === appointment.id}
                    onConfirm={() => updateStatus(appointment.id, "CONFIRMED")}
                    onComplete={() => updateStatus(appointment.id, "COMPLETED")}
                    onCancel={() => updateStatus(appointment.id, "CANCELLED")}
                />
            ))}
        </div>
    )
}