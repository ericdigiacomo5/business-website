import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, PaymentMethod, Prisma } from "@/generated/prisma/client";
import { getOpenSlots } from "@/lib/availability";

const SLOT_DURATION_MS = 15 * 60_000;

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: { service: true },
    })

    if (!appointment) {
        return Response.json(
            { error: "Appointment not found" },
            { status: 404 }
        )
    }

    let body: unknown;
    try {
        body = await request.json()
    } catch {
        return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        )
    }

    if (typeof body !== 'object' || body === null) {
        return Response.json(
            { error: 'Invalid request body' },
            { status: 400 }
        )
    }

    const { status, paymentMethod, startTime } = body as Record<string, unknown>

    // status is optional — a pure reschedule (startTime only) shouldn't have
    // to also restate the current status. At least one of the two has to be
    // present, or this PATCH would be a no-op.
    if (status === undefined && startTime === undefined) {
        return Response.json(
            { error: 'Provide status and/or startTime' },
            { status: 400 }
        )
    }

    if (status !== undefined && (typeof status !== 'string' || !(Object.values(AppointmentStatus) as string[]).includes(status))) {
        return Response.json(
            { error: 'Status must be one of UPCOMING, CONFIRMED, CANCELLED, COMPLETED' },
            { status: 400 }
        )
    }

    // Checkout: completing an appointment is how payment gets recorded —
    // the physical POS handles the actual charge, this just logs how it was
    // paid. Require a valid paymentMethod any time status is being set to
    // COMPLETED, whether from CONFIRMED (the normal checkout flow) or from
    // any other status (e.g. re-marking a booking complete after a mistake).
    if (status === AppointmentStatus.COMPLETED) {
        if (typeof paymentMethod !== 'string' || !(Object.values(PaymentMethod) as string[]).includes(paymentMethod)) {
            return Response.json(
                { error: 'paymentMethod must be one of CASH, CARD, OTHER when completing an appointment' },
                { status: 400 }
            )
        }
    } else if (paymentMethod !== undefined) {
        return Response.json(
            { error: 'paymentMethod can only be set when status is COMPLETED' },
            { status: 400 }
        )
    }

    // Reschedule: admin-only (this whole route already is), same artist and
    // service — only the time moves. A different artist or service is really
    // "cancel and rebook," not a reschedule, and is deliberately out of scope
    // here (see FEATURE_GAPS.md Gap 4). Not folded into bookOccurrence()
    // (the one-off booking transaction) since this reuses the appointment's
    // existing row/id instead of creating a new one, and has to free its own
    // old slots first — a genuinely different shape, not a smaller version
    // of booking.
    let parsedStartTime: Date | null = null
    if (startTime !== undefined) {
        // Only makes sense on a booking that hasn't already happened or been
        // resolved — same reasoning as the checkout gate just above: keep
        // each field meaningful only in the context where it applies. Uses
        // whichever status the appointment will actually end up at, so
        // status and startTime can be sent together (e.g. confirm + move in
        // one request) without fighting each other.
        const resultingStatus = (status as AppointmentStatus | undefined) ?? appointment.status
        if (resultingStatus !== AppointmentStatus.UPCOMING && resultingStatus !== AppointmentStatus.CONFIRMED) {
            return Response.json(
                { error: 'Only an UPCOMING or CONFIRMED appointment can be rescheduled' },
                { status: 400 }
            )
        }

        if (typeof startTime !== 'string' && typeof startTime !== 'number') {
            return Response.json(
                { error: 'startTime must be a date/time' },
                { status: 400 }
            )
        }

        const candidate = new Date(startTime)
        const isOnSlotGrid =
            candidate.getMinutes() % 15 === 0 &&
            candidate.getSeconds() === 0 &&
            candidate.getMilliseconds() === 0
        if (isNaN(candidate.getTime()) || !isOnSlotGrid) {
            return Response.json(
                { error: 'startTime is invalid' },
                { status: 400 }
            )
        }
        // No past-time rejection here, unlike the customer-facing booking
        // route — this whole route is already requireAdmin()-gated, so every
        // caller already is the admin case that route exempts.

        parsedStartTime = candidate
    }

    try {
        const updated = await prisma.$transaction(async (tx) => {
            const data: Prisma.AppointmentUpdateInput = {}

            if (status !== undefined) {
                data.status = status as AppointmentStatus
            }

            if (status === AppointmentStatus.COMPLETED) {
                data.paymentMethod = paymentMethod as PaymentMethod
                data.checkedOutAt = new Date()
            }

            if (status === AppointmentStatus.CANCELLED || status === AppointmentStatus.NO_SHOW) {
                // Same soft-cancel contract as DELETE /api/appointments/:id
                // — free the slots so the grid opens back up, keep the
                // Appointment row as a historical record. A no-show frees the
                // slot for the same reason a cancellation does: the customer
                // isn't coming, so there's no reason to keep the time blocked.
                await tx.appointmentSlot.deleteMany({
                    where: { appointmentId: id }
                })
            }

            if (parsedStartTime) {
                const newEndTime = new Date(
                    parsedStartTime.getTime() + appointment.service.durationMinutes * 60_000
                )

                const newSlots: Date[] = []
                let current = parsedStartTime
                while (current < newEndTime) {
                    newSlots.push(current)
                    current = new Date(current.getTime() + SLOT_DURATION_MS)
                }

                // Free the old slots first — this also correctly lets a
                // reschedule land back on (part of) its own current time
                // without a false "not available" from its own booking.
                await tx.appointmentSlot.deleteMany({
                    where: { appointmentId: id }
                })

                const openSlots = await getOpenSlots(appointment.artistId, parsedStartTime, { allowPast: true })
                const openSlotTimes = new Set(openSlots.map((slot) => slot.getTime()))
                const isFullyAvailable = newSlots.every((slot) => openSlotTimes.has(slot.getTime()))

                if (!isFullyAvailable) {
                    throw new Error('SLOT_UNAVAILABLE')
                }

                await tx.appointmentSlot.createMany({
                    data: newSlots.map((slotStart) => ({
                        artistId: appointment.artistId,
                        slotStart,
                        appointmentId: id,
                    })),
                })

                data.startTime = parsedStartTime
                data.endTime = newEndTime
            }

            return tx.appointment.update({
                where: { id },
                data,
            })
        })

        return Response.json({ data: updated }, { status: 200 })
    } catch (error) {
        if (error instanceof Error && error.message === 'SLOT_UNAVAILABLE') {
            return Response.json(
                { error: 'That time is not available' },
                { status: 400 }
            )
        }

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            // Race between the availability check above and this write —
            // another request claimed the same slot in between. Same
            // pattern as bookOccurrence()'s own P2002 handling.
            return Response.json(
                { error: 'That time was just booked, please pick another' },
                { status: 409 }
            )
        }

        // Race between the findUnique above and this update — e.g. the row
        // was removed in between. Same pattern as admin/availability/[id].
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: 'Appointment not found' },
                { status: 404 }
            )
        }

        throw error
    }
}
