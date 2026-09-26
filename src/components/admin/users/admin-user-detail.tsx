'use client'

import { useState } from "react"
import type { Appointment, Artist, Service } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProfileForm, type ProfileFormValues } from "@/components/account/profile-form"
import { formatDuration, formatPrice } from "@/lib/format"
import { STATUS_LABEL, STATUS_TONE } from "@/components/admin/appointment-shared"
import { AdminRecurringAppointments } from "./admin-recurring-appointments"
import type { AdminUser } from "./admin-user-row"

type UserAppointment = Appointment & { artist: Artist; service: Service }

export function AdminUserDetail({
    user,
    appointments,
}: {
    user: AdminUser
    appointments: UserAppointment[]
}) {
    const [current, setCurrent] = useState(user)
    const [editing, setEditing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    async function handleSave(values: ProfileFormValues) {
        setError(null)
        setSaving(true)

        try {
            const res = await fetch(`/api/admin/users/${current.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't save changes. Please try again.")
                return
            }

            const body = await res.json()
            setCurrent(body.data)
            setEditing(false)
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="mt-4">
            {error && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}

            {editing ? (
                <ProfileForm
                    submitLabel={saving ? "Saving..." : "Save Changes"}
                    initial={{ name: current.name ?? "", email: current.email, phone: current.phone }}
                    onSubmit={handleSave}
                    onCancel={() => setEditing(false)}
                />
            ) : (
                <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-surface-foreground">{current.name || "(no name)"}</span>
                            <Badge tone={current.role === "ADMIN" ? "success" : "muted"}>{current.role}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{current.email}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{current.phone}</p>
                    </div>

                    <Button variant="secondary" size="md" onClick={() => setEditing(true)}>
                        Edit
                    </Button>
                </div>
            )}

            <h3 className="mt-8 text-base font-semibold text-foreground">Standing Appointments</h3>
            <AdminRecurringAppointments userId={current.id} />

            <h3 className="mt-8 text-base font-semibold text-foreground">Appointment History</h3>

            {appointments.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No appointments yet.</p>
            ) : (
                <div className="mt-3 flex flex-col gap-2">
                    {appointments.map((appointment) => (
                        <div
                            key={appointment.id}
                            className="flex flex-col gap-2 rounded-sm border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">{appointment.service.name}</span>
                                    <Badge tone={STATUS_TONE[appointment.status]}>{STATUS_LABEL[appointment.status]}</Badge>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">with {appointment.artist.name}</p>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                    {new Date(appointment.startTime).toLocaleString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </p>
                            </div>
                            <div className="text-sm text-muted-foreground sm:text-right">
                                {formatDuration(appointment.service.durationMinutes)} &middot;{" "}
                                {formatPrice(appointment.service.priceCents)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
