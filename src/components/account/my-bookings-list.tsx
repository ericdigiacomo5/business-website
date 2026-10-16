'use client'

import { useState } from "react"
import { AppointmentCard, type AppointmentWithRelations } from "./appointment-card"
import { Button } from "@/components/ui/button"
import { DateTimeStep } from "@/components/booking/steps/datetime-step"
import { customerChangeDeadline, describeNoticeWindow } from "@/lib/recurring"
import { durationMinutesOf } from "@/lib/schedule-grid"

function isUpcoming(appointment: AppointmentWithRelations, now: number) {
    const isActive = appointment.status === "PENDING" || appointment.status === "CONFIRMED"
    const isFuture = new Date(appointment.startTime).getTime() > now
    return isActive && isFuture
}

function formatWhen(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })
}

export function MyBookingsList({
    initialAppointments,
    cancellationNoticeHours,
}: {
    initialAppointments: AppointmentWithRelations[]
    // The salon's notice window (AppSettings). Inside it, Cancel and
    // Reschedule are replaced by a "contact the salon" note — the API
    // enforces the same rule, this just avoids offering buttons that fail.
    cancellationNoticeHours: number
}) {
    const [appointments, setAppointments] = useState(initialAppointments)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    // The appointment being rescheduled, and the new time picked for it
    // (null until a slot is chosen; then a confirm step shows).
    const [reschedulingId, setReschedulingId] = useState<string | null>(null)
    const [pickedTime, setPickedTime] = useState<{ date: string; startTime: string } | null>(null)

    // "Now" as of page load — render must be pure, and a few minutes of drift
    // only matters right at a deadline, where the API has the final say.
    const [now] = useState(() => Date.now())

    const canChangeOnline = (appointment: AppointmentWithRelations) =>
        now <= customerChangeDeadline(appointment.startTime, cancellationNoticeHours).getTime()

    function startReschedule(id: string) {
        setError(null)
        setPickedTime(null)
        setReschedulingId(id)
    }

    function stopReschedule() {
        setPickedTime(null)
        setReschedulingId(null)
    }

    async function handleCancel(id: string) {
        setError(null)
        setBusyId(id)

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
            setBusyId(null)
        }
    }

    async function handleReschedule(id: string, startTime: string) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startTime }),
            })

            const body = await res.json().catch(() => null)

            if (!res.ok) {
                setError(body?.error ?? "Couldn't move that booking. Please try again.")
                // The time was probably taken meanwhile — back to the picker,
                // on the same day.
                setPickedTime((picked) => (picked ? { ...picked, startTime: "" } : null))
                return
            }

            const updated: AppointmentWithRelations = body.data
            setAppointments((prev) =>
                prev
                    .map((a) => (a.id === id ? updated : a))
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            )
            stopReschedule()
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    if (appointments.length === 0) {
        return <p className="mt-8 text-muted-foreground">You don&apos;t have any bookings yet.</p>
    }

    const upcoming = appointments.filter((a) => isUpcoming(a, now))
    const other = appointments.filter((a) => !isUpcoming(a, now))

    function renderUpcoming(appointment: AppointmentWithRelations) {
        const busy = busyId === appointment.id
        const isRescheduling = reschedulingId === appointment.id

        if (!canChangeOnline(appointment)) {
            return (
                <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    upcoming
                    footer={
                        <p className="mt-3 text-sm text-muted-foreground">
                            Less than {describeNoticeWindow(cancellationNoticeHours)} away — to change or cancel,
                            please contact the salon.
                        </p>
                    }
                />
            )
        }

        const actions = !isRescheduling && (
            <>
                <Button
                    variant="secondary"
                    size="md"
                    onClick={() => startReschedule(appointment.id)}
                    disabled={busy || reschedulingId !== null}
                >
                    Reschedule
                </Button>
                <Button
                    variant="danger"
                    size="md"
                    onClick={() => handleCancel(appointment.id)}
                    disabled={busy || reschedulingId !== null}
                >
                    {busy ? "Cancelling..." : "Cancel"}
                </Button>
            </>
        )

        const footer = isRescheduling && (
            <div className="mt-5 border-t border-border pt-5">
                {pickedTime?.startTime ? (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-foreground">
                            Move to <span className="font-semibold">{formatWhen(pickedTime.startTime)}</span>?
                            {appointment.status === "CONFIRMED" &&
                                " The salon will confirm the new time."}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                size="md"
                                onClick={() => handleReschedule(appointment.id, pickedTime.startTime)}
                                disabled={busy}
                            >
                                {busy ? "Saving..." : "Confirm New Time"}
                            </Button>
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={() => setPickedTime({ ...pickedTime, startTime: "" })}
                                disabled={busy}
                            >
                                Choose Another Time
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <DateTimeStep
                            artistId={appointment.artistId}
                            initialDate={pickedTime?.date ?? null}
                            serviceDurationMinutes={durationMinutesOf(appointment)}
                            excludeAppointmentId={appointment.id}
                            heading={`New time with ${appointment.artist.name}`}
                            onSelect={(date, startTime) => setPickedTime({ date, startTime })}
                        />
                        <Button variant="ghost" size="md" onClick={stopReschedule} className="mt-4">
                            Keep Current Time
                        </Button>
                    </>
                )}
            </div>
        )

        return (
            <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                upcoming
                actions={actions}
                footer={footer}
            />
        )
    }

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
                    <div className="mt-5 flex flex-col gap-4">{upcoming.map(renderUpcoming)}</div>
                </section>
            )}

            {other.length > 0 && (
                <section>
                    <h2 className="border-b-2 border-foreground pb-2.5 font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Past &amp; Cancelled
                    </h2>
                    <div className="mt-5 flex flex-col gap-4">
                        {other.map((appointment) => (
                            <AppointmentCard key={appointment.id} appointment={appointment} upcoming={false} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}
