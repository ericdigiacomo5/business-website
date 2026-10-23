'use client'

import { useState } from "react"
import type { AppointmentStatus, Service } from "@/generated/prisma/client"
import { SLOT_MINUTES, type ScheduleColumn, type ScheduleView } from "@/lib/schedule-grid"
import { toLocalDateKey } from "@/lib/format"
import type { Discount } from "@/lib/discount"
import { ScheduleTimeAxis } from "./schedule-time-axis"
import { ScheduleArtistColumn } from "./schedule-artist-column"
import { ScheduleDetailSheet, type Checkout, type Rebooking } from "./schedule-detail-sheet"
import { servicesLabel } from "@/lib/appointment-services"
import { ScheduleBookSheet } from "./schedule-book-sheet"
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABEL } from "@/lib/service-category"
import { CATEGORY_BLOCK_COLOR, STATUS_BAR_COLOR, STATUS_LABEL, type AdminAppointment } from "./appointment-shared"
import { useToast } from "@/components/ui/toast"
import { ScheduleNowLine } from "./schedule-now-line"
import { formatSalonDateTime } from "@/lib/salon-time"

// One 15-minute row. A CSS variable rather than a constant: globals.css sets
// it to 24px for a mouse and 44px on touch screens (pointer: coarse), so
// every empty cell — a tap-to-book button — meets the 44px tap-target rule
// on phones and tablets without making the desktop grid three times taller.
const ROW_HEIGHT = "var(--schedule-row-height)"

// The toast after a status change (FEATURE_GAPS.md U4). Customer-facing
// emails go out for cancellations and checkouts (receipts), not the others.
const STATUS_TOAST: Record<AppointmentStatus, string> = {
    PENDING: "Marked pending.",
    CONFIRMED: "Confirmed.",
    COMPLETED: "Checked out — receipt sent.",
    CANCELLED: "Cancelled — the customer has been emailed.",
    NO_SHOW: "Marked as a no-show.",
}

export function ScheduleGrid({
    initialAppointments,
    view,
    columns,
    services,
    offeredServiceIds,
    noShowCounts,
    gridBounds,
    maxSeriesWeeks,
}: {
    initialAppointments: AdminAppointment[]
    view: ScheduleView
    // Day view: one per artist, all the same day. Week view: one per day,
    // all the same artist. Each carries its own working hours and time off.
    columns: ScheduleColumn[]
    // Active services, for booking from an empty cell.
    services: Service[]
    // artistId → the services they perform ([] = every service), for the
    // booking sheet's warning.
    offeredServiceIds: Record<string, string[]>
    // userId → lifetime no-shows, for the detail sheet's flag. Customers
    // with none are absent.
    noShowCounts: Record<string, number>
    gridBounds: { start: string; end: string }
    // The salon's standing-appointment cap, for the booking dialog.
    maxSeriesWeeks: number
}) {
    const [appointments, setAppointments] = useState(initialAppointments)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    // The empty cell being booked, if any — clicking the grid is how an
    // admin creates an appointment (there is no separate booking page).
    const [bookingSlot, setBookingSlot] = useState<{ artistId: string; startTime: Date } | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const toast = useToast()

    const columnKey = (artistId: string, dateKey: string) => `${artistId}|${dateKey}`
    const displayedColumnKeys = new Set(columns.map((c) => columnKey(c.artist.id, toLocalDateKey(c.date))))
    const appointmentColumnKey = (a: AdminAppointment) => columnKey(a.artistId, toLocalDateKey(new Date(a.startTime)))
    const isDisplayed = (a: AdminAppointment) => displayedColumnKeys.has(appointmentColumnKey(a))

    // Shared by every PATCH this grid makes (status changes and reschedules
    // alike) — merges the server's returned row into local state, except
    // when a reschedule has moved the appointment off every displayed column,
    // in which case it's removed instead. (In the week view, a move to
    // another day of the same week just changes column.) There's no live
    // refresh on this page (see FEATURE_GAPS.md Gap 16), so without this an
    // appointment rescheduled elsewhere would keep rendering at a nonsensical
    // position until a manual reload.
    function applyUpdate(id: string, updated: AdminAppointment) {
        // The server's row always carries artistId and startTime.
        const stillDisplayed = isDisplayed(updated)
        setAppointments((prev) =>
            stillDisplayed
                ? prev.map((a) => (a.id === id ? { ...a, ...updated } : a))
                : prev.filter((a) => a.id !== id)
        )
    }

    // Same no-live-refresh reasoning as applyUpdate: a new booking is merged
    // into local state rather than refetched. A standing appointment returns
    // every week it booked; only those in a displayed column belong here.
    function handleBooked(created: AdminAppointment[], bookedNotice: string | null) {
        setAppointments((prev) => [...prev, ...created.filter(isDisplayed)])
        setNotice(bookedNotice)
        setBookingSlot(null)
    }

    // `checkout` only with COMPLETED. paymentMethod is null when store
    // credit (or a discount) left nothing for the POS.
    async function updateStatus(id: string, status: AppointmentStatus, checkout?: Checkout) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/admin/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status,
                    ...(checkout?.paymentMethod && { paymentMethod: checkout.paymentMethod }),
                    ...(checkout && checkout.creditCents > 0 && { creditCents: checkout.creditCents }),
                }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't update that booking. Please try again.")
                return
            }

            const body = await res.json()
            applyUpdate(id, body.data)
            toast(STATUS_TOAST[status])
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    async function updateDiscount(id: string, discount: Discount | null) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/admin/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ discount }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't update that discount. Please try again.")
                return
            }

            const body = await res.json()
            applyUpdate(id, body.data)
            toast(discount ? "Discount applied." : "Discount removed.")
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    async function updateServices(id: string, serviceIds: string[]) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/admin/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serviceIds }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't change that appointment's services. Please try again.")
                return
            }

            const body = await res.json()
            applyUpdate(id, body.data)
            toast("Services updated.")
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    async function updateLength(id: string, durationMinutes: number) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/admin/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ durationMinutes }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't change that appointment's length. Please try again.")
                return
            }

            const body = await res.json()
            applyUpdate(id, body.data)
            toast("Length updated.")
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    // Gives back the store credit spent on a completed appointment.
    async function returnCredit(id: string, note: string) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/admin/appointments/${id}/return-credit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't return that credit. Please try again.")
                return
            }

            const body = await res.json()
            applyUpdate(id, body.data)
            toast("Store credit returned to the customer.")
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    async function rescheduleAppointment(id: string, startTime: string) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/admin/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startTime }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't reschedule that booking. Please try again.")
                return
            }

            const body = await res.json()
            applyUpdate(id, body.data)
            toast("Rescheduled — the customer has been emailed.")
            setSelectedId(null)
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    // Books the client's next visit from a completed appointment (see
    // RebookForm in schedule-detail-sheet.tsx). Same route the grid's own
    // booking dialog uses; admin-only fields (userId, durationMinutes) are
    // honored because the session is an admin's.
    async function rebook(from: AdminAppointment, rebooking: Rebooking) {
        setError(null)
        setBusyId(from.id)

        try {
            const res = await fetch("/api/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    artistId: from.artistId,
                    userId: from.userId,
                    serviceIds: rebooking.serviceIds,
                    startTime: rebooking.startTime,
                    ...(rebooking.durationMinutes !== null && { durationMinutes: rebooking.durationMinutes }),
                }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't book the next visit. Please try again.")
                return
            }

            const body = await res.json()
            const created: AdminAppointment = { ...body.data, artist: from.artist, user: from.user }
            const when = formatSalonDateTime(created.startTime, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            })
            // Usually on a later day, so the notice is the only sign it
            // worked; handleBooked adds the block if it's today.
            handleBooked(
                [created],
                `Next visit booked for ${from.user.name ?? from.user.email}: ${servicesLabel(created.services)}, ${when}.`
            )
            setSelectedId(null)
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    if (columns.length === 0) {
        return <p className="mt-8 text-muted-foreground">No artists to schedule.</p>
    }

    const usingFallbackBounds = columns.every((c) => c.workingWindow.start === null)

    const [startHours, startMinutesPart] = gridBounds.start.split(":").map(Number)
    const [endHours, endMinutesPart] = gridBounds.end.split(":").map(Number)
    const gridStartMinutes = startHours * 60 + startMinutesPart
    const gridEndMinutes = endHours * 60 + endMinutesPart
    const totalRows = (gridEndMinutes - gridStartMinutes) / SLOT_MINUTES

    const todayKey = toLocalDateKey(new Date())
    const todayColumns = columns.flatMap((c, i) => (toLocalDateKey(c.date) === todayKey ? [i] : []))

    const selectedAppointment = appointments.find((a) => a.id === selectedId) ?? null
    const bookingArtist = bookingSlot
        ? (columns.find((c) => c.artist.id === bookingSlot.artistId)?.artist ?? null)
        : null

    return (
        <div className="mt-6">
            {usingFallbackBounds && (
                <p className="mb-3 text-sm text-muted-foreground">
                    {`No working hours are set for this ${view === "week" ? "week" : "date"} — showing a default 9am–5pm range.`}
                </p>
            )}

            {/* While the detail sheet is open it shows the error itself — up
                here it would sit behind the sheet's overlay. */}
            {error && !selectedAppointment && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}
            {notice && (
                <p role="status" className="mb-3 text-sm text-foreground">
                    {notice}
                </p>
            )}

            <p className="mb-3 text-sm text-muted-foreground">Click an open time to book an appointment.</p>

            {/* Legend (FEATURE_GAPS.md U13): a block's fill is its first
                service's category, its left-edge bar its status, and the red
                line is the current time. */}
            <div className="mb-3 flex flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6">
                <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Service categories">
                    {SERVICE_CATEGORIES.map((category) => (
                        <li key={category} className="flex items-center gap-1.5">
                            <span
                                className={`h-3 w-3 rounded-sm border ${CATEGORY_BLOCK_COLOR[category].block} ${CATEGORY_BLOCK_COLOR[category].blockBorder}`}
                                aria-hidden
                            />
                            {SERVICE_CATEGORY_LABEL[category]}
                        </li>
                    ))}
                </ul>
                <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Statuses">
                    {(["PENDING", "CONFIRMED", "COMPLETED"] as const).map((status) => (
                        <li key={status} className="flex items-center gap-1.5">
                            <span className={`h-3 w-1 rounded-sm ${STATUS_BAR_COLOR[status]}`} aria-hidden />
                            {STATUS_LABEL[status].charAt(0) + STATUS_LABEL[status].slice(1).toLowerCase()}
                        </li>
                    ))}
                    {todayColumns.length > 0 && (
                        <li className="flex items-center gap-1.5">
                            <span className="h-0.5 w-4 bg-danger" aria-hidden />
                            Now
                        </li>
                    )}
                </ul>
            </div>

            <div className="-mx-4 overflow-x-auto px-4">
                <div
                    className="grid"
                    style={{
                        // Narrower minimum in the week view so all seven days
                        // fit beside the calendar panel on a desktop; below
                        // that the grid scrolls sideways in its container.
                        gridTemplateColumns: `64px repeat(${columns.length}, minmax(${view === "week" ? 88 : 112}px, 1fr))`,
                        gridTemplateRows: `auto repeat(${totalRows}, ${ROW_HEIGHT})`,
                    }}
                >
                    <ScheduleTimeAxis gridStartMinutes={gridStartMinutes} totalRows={totalRows} />

                    {/* Today's columns are contiguous: all of them in the day
                        view, one in the week view. +2: the time axis is
                        column 1 and grid lines are 1-based. */}
                    {todayColumns.length > 0 && (
                        <ScheduleNowLine
                            gridStartMinutes={gridStartMinutes}
                            gridEndMinutes={gridEndMinutes}
                            firstColumn={todayColumns[0] + 2}
                            lastColumn={todayColumns[todayColumns.length - 1] + 2}
                        />
                    )}

                    {columns.map((scheduleColumn, index) => {
                        const key = columnKey(scheduleColumn.artist.id, toLocalDateKey(scheduleColumn.date))
                        return (
                            <ScheduleArtistColumn
                                key={key}
                                scheduleColumn={scheduleColumn}
                                columnIndex={index}
                                appointments={appointments.filter((a) => appointmentColumnKey(a) === key)}
                                gridStartMinutes={gridStartMinutes}
                                totalRows={totalRows}
                                onSelect={(id) => {
                                    setError(null)
                                    setSelectedId(id)
                                }}
                                onBookSlot={(artistId, startTime) => {
                                    setNotice(null)
                                    setBookingSlot({ artistId, startTime })
                                }}
                            />
                        )
                    })}
                </div>
            </div>

            <ScheduleDetailSheet
                key={selectedId}
                appointment={selectedAppointment}
                customerNoShows={selectedAppointment ? (noShowCounts[selectedAppointment.userId] ?? 0) : 0}
                busy={busyId === selectedId}
                error={error}
                onConfirm={() => selectedId && updateStatus(selectedId, "CONFIRMED")}
                onCheckout={(checkout) => selectedId && updateStatus(selectedId, "COMPLETED", checkout)}
                onReturnCredit={(note) => selectedId && returnCredit(selectedId, note)}
                onCancel={() => selectedId && updateStatus(selectedId, "CANCELLED")}
                onNoShow={() => selectedId && updateStatus(selectedId, "NO_SHOW")}
                onReschedule={(startTime) => selectedId && rescheduleAppointment(selectedId, startTime)}
                onDiscount={(discount) => selectedId && updateDiscount(selectedId, discount)}
                onChangeLength={(minutes) => selectedId && updateLength(selectedId, minutes)}
                services={services}
                onChangeServices={(serviceIds) => selectedId && updateServices(selectedId, serviceIds)}
                onRebook={(rebooking) => selectedAppointment && rebook(selectedAppointment, rebooking)}
                onClose={() => {
                    setError(null)
                    setSelectedId(null)
                }}
            />

            {bookingSlot && bookingArtist && (
                <ScheduleBookSheet
                    // Keyed so picking a different cell starts a fresh booking.
                    key={`${bookingSlot.artistId}|${bookingSlot.startTime.getTime()}`}
                    artist={bookingArtist}
                    startTime={bookingSlot.startTime}
                    services={services}
                    offeredServiceIds={offeredServiceIds[bookingArtist.id] ?? []}
                    maxSeriesWeeks={maxSeriesWeeks}
                    onBooked={handleBooked}
                    onClose={() => setBookingSlot(null)}
                />
            )}
        </div>
    )
}
