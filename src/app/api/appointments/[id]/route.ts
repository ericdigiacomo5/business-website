import { NextRequest, after } from "next/server"
import { sendCancellationNotice, sendRescheduleNotice } from "@/lib/appointment-emails"
import { prisma } from "@/lib/prisma"
import { Prisma, type Appointment } from "@/generated/prisma/client"
import { requireUser } from "@/lib/require-user"
import { readJsonObject } from "@/lib/request"
import { getPolicySettings, isBookingEnabled } from "@/lib/settings"
import { BOOKING_WINDOW_DAYS, bookingWindowEnd, customerChangeDeadline, describeNoticeWindow } from "@/lib/recurring"
import { durationMinutesOf } from "@/lib/schedule-grid"
import { reclaimSlots, SlotUnavailableError } from "@/lib/booking"
import { SERVICE_LINES_INCLUDE } from "@/lib/appointment-services"

// The checks a customer's own cancel and reschedule share: the appointment
// exists, belongs to the caller, is still active, and isn't inside the
// salon's notice window. Returns the appointment, or a Response to return.
//
// This route only ever acts on the caller's own appointment — an admin
// acting on someone else's behalf goes through
// PATCH /api/admin/appointments/[id] instead, which has no notice window.
async function loadOwnChangeableAppointment(
    appointmentId: string,
    userId: string,
    action: "cancelled" | "rescheduled"
): Promise<Appointment | Response> {
    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
    })

    if (!appointment) {
        return Response.json({ error: "Appointment not found" }, { status: 404 })
    }

    // Ownership check — requireUser() only confirms *someone* is signed in;
    // without this, any authenticated user could change any other user's
    // appointment by id.
    if (appointment.userId !== userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    // A CANCELLED/COMPLETED/NO_SHOW appointment has nothing left to change —
    // without this, a far-future (outside the notice window) appointment
    // already in a terminal state would fall through the notice-window check
    // below. Checked first since it's the more fundamental gate: timing is
    // irrelevant to an appointment that can't be changed at all.
    if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
        return Response.json(
            { error: `This appointment can no longer be ${action}` },
            { status: 400 },
        )
    }

    // Also covers an appointment that already started or passed — its
    // deadline is behind us by definition.
    const { cancellationNoticeHours } = await getPolicySettings()
    if (Date.now() > customerChangeDeadline(appointment.startTime, cancellationNoticeHours).getTime()) {
        const verb = action === "cancelled" ? "cancel" : "reschedule"
        return Response.json(
            {
                error: `Online, you can only ${verb} at least ${describeNoticeWindow(cancellationNoticeHours)} in advance. Please contact the salon.`,
            },
            { status: 400 },
        )
    }

    return appointment
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const { id: appointmentId } = await params

    const appointment = await loadOwnChangeableAppointment(appointmentId, userId, "cancelled")
    if (appointment instanceof Response) return appointment

    try {
        const cancelled = await prisma.$transaction(async (tx) => {
            // Cancelling is a soft update, not a real delete — the
            // Appointment row is kept as a historical record (status:
            // CANCELLED), matching Service's active-flag soft-delete. The
            // slots still need to be removed, though, or the grid stays
            // permanently blocked for a booking that no longer holds it.
            await tx.appointmentSlot.deleteMany({
                where: { appointmentId },
            })

            return tx.appointment.update({
                where: { id: appointmentId },
                data: { status: "CANCELLED" },
            })
        })

        after(() => sendCancellationNotice(cancelled.id, "customer"))

        return Response.json({ data: cancelled })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return Response.json({ error: "Appointment not found" }, { status: 404 })
        }

        throw error
    }
}

// Customer self-service reschedule: move one's own appointment to another
// open time, same artist, same services, same length. Same notice window as
// cancelling, and the new time must fall inside the normal customer booking
// window. The appointment goes back to PENDING so staff re-confirm the new
// time, and the customer gets the reschedule email. Anything more (another
// artist, other services) is cancel-and-rebook, or a call to the salon.
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    // Rescheduling is self-booking: closed when the salon has switched
    // online booking off, same as POST /api/appointments.
    if (!(await isBookingEnabled())) {
        return Response.json(
            { error: "Online booking is currently closed. Please contact the salon directly." },
            { status: 403 },
        )
    }

    const { id: appointmentId } = await params

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const { startTime } = body
    if (typeof startTime !== "string" && typeof startTime !== "number") {
        return Response.json({ error: "startTime is required" }, { status: 400 })
    }

    const newStart = new Date(startTime)
    const isOnSlotGrid =
        newStart.getMinutes() % 15 === 0 && newStart.getSeconds() === 0 && newStart.getMilliseconds() === 0
    if (isNaN(newStart.getTime()) || !isOnSlotGrid || newStart.getTime() < Date.now()) {
        return Response.json({ error: "Time is invalid" }, { status: 400 })
    }

    if (newStart.getTime() >= bookingWindowEnd().getTime()) {
        return Response.json(
            { error: `You can book up to ${BOOKING_WINDOW_DAYS} days in advance` },
            { status: 400 },
        )
    }

    const appointment = await loadOwnChangeableAppointment(appointmentId, userId, "rescheduled")
    if (appointment instanceof Response) return appointment

    if (newStart.getTime() === appointment.startTime.getTime()) {
        return Response.json({ error: "That's already your appointment time" }, { status: 400 })
    }

    const artist = await prisma.artist.findUnique({ where: { id: appointment.artistId } })
    if (!artist?.active) {
        return Response.json(
            { error: "This artist isn't taking online bookings right now. Please contact the salon." },
            { status: 400 },
        )
    }

    const previousStartTime = appointment.startTime

    try {
        const updated = await prisma.$transaction(async (tx) => {
            // Same length as now — an admin may have set a custom length for
            // this client, and a customer move must not undo it.
            const span = await reclaimSlots(tx, {
                appointmentId,
                artistId: appointment.artistId,
                startTime: newStart,
                durationMinutes: durationMinutesOf(appointment),
                allowPast: false,
            })

            return tx.appointment.update({
                where: { id: appointmentId },
                data: {
                    startTime: span.startTime,
                    endTime: span.endTime,
                    // Staff confirm the new time, same as a new booking.
                    status: "PENDING",
                    // Any reminder already sent was for the old time.
                    reminderSentAt: null,
                },
                include: { artist: true, ...SERVICE_LINES_INCLUDE },
            })
        })

        after(() => sendRescheduleNotice(appointmentId, previousStartTime))

        return Response.json({ data: updated })
    } catch (error) {
        if (error instanceof SlotUnavailableError) {
            return Response.json({ error: "That time is not available" }, { status: 400 })
        }
        // Someone booked one of the slots between the check and the write.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return Response.json({ error: "That time was just booked, please pick another" }, { status: 409 })
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return Response.json({ error: "Appointment not found" }, { status: 404 })
        }
        throw error
    }
}
