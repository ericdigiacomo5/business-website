import { after } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { readJsonObject } from "@/lib/request";
import { sendCancellationNotice, sendReceipt, sendRescheduleNotice } from "@/lib/appointment-emails";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, PaymentMethod, Prisma, type DiscountType } from "@/generated/prisma/client";
import { durationMinutesOf, isValidAppointmentLength, MAX_APPOINTMENT_MINUTES } from "@/lib/schedule-grid";
import { discountError } from "@/lib/discount";
import { loadServicesToBook, reclaimSlots, SlotUnavailableError, type ServiceToBook } from "@/lib/booking";
import {
    parseServiceIds,
    SERVICE_LINES_INCLUDE,
    servicesDurationMinutes,
    servicesFitOneAppointment,
    servicesPriceCents,
} from "@/lib/appointment-services";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: SERVICE_LINES_INCLUDE,
    })

    if (!appointment) {
        return Response.json(
            { error: "Appointment not found" },
            { status: 404 }
        )
    }

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const { status, paymentMethod, startTime, durationMinutes, discount, serviceIds } = body

    // status is optional — a pure reschedule (startTime only), length
    // change, services change, or discount change shouldn't have to also
    // restate the current status. At least one has to be present, or this
    // PATCH would be a no-op.
    if (
        status === undefined &&
        startTime === undefined &&
        durationMinutes === undefined &&
        discount === undefined &&
        serviceIds === undefined
    ) {
        return Response.json(
            { error: 'Provide status, startTime, durationMinutes, serviceIds and/or discount' },
            { status: 400 }
        )
    }

    if (status !== undefined && (typeof status !== 'string' || !(Object.values(AppointmentStatus) as string[]).includes(status))) {
        return Response.json(
            { error: 'Status must be one of PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW' },
            { status: 400 }
        )
    }

    // CANCELLED and NO_SHOW free the appointment's AppointmentSlot rows (see
    // the transaction below), and nothing re-claims them. Moving one back to
    // PENDING/CONFIRMED would leave a live booking that holds no slots, so the
    // same time could be booked again on top of it — the double-booking the
    // slot table exists to prevent. The schedule UI never offers this; a
    // reinstated booking is a new booking.
    if (
        (status === AppointmentStatus.PENDING || status === AppointmentStatus.CONFIRMED) &&
        (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.NO_SHOW)
    ) {
        return Response.json(
            { error: 'A cancelled or no-show appointment can\'t be reopened — book a new appointment instead' },
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

    // Services: replaces the appointment's whole list (e.g. a client adds a
    // service at the chair). Same gate as a reschedule, since the usual
    // length changes with the services and the slots are re-claimed below.
    // A service that stays keeps the price and duration it was booked at;
    // one that's added takes the service's current values.
    let newServices: ServiceToBook[] | null = null
    if (serviceIds !== undefined) {
        const resultingStatus = (status as AppointmentStatus | undefined) ?? appointment.status
        if (resultingStatus !== AppointmentStatus.PENDING && resultingStatus !== AppointmentStatus.CONFIRMED) {
            return Response.json(
                { error: "Only a PENDING or CONFIRMED appointment's services can be changed" },
                { status: 400 }
            )
        }

        const parsedIds = parseServiceIds(serviceIds)
        if (typeof parsedIds === 'string') {
            return Response.json(
                { error: parsedIds },
                { status: 400 }
            )
        }

        const current = await loadServicesToBook(parsedIds)
        if (!current) {
            return Response.json(
                { error: 'Service not found' },
                { status: 404 }
            )
        }

        newServices = current.map((service) => {
            const existing = appointment.services.find((line) => line.serviceId === service.serviceId)
            return existing
                ? { serviceId: existing.serviceId, priceCents: existing.priceCents, durationMinutes: existing.durationMinutes }
                : service
        })

        // Only matters when no explicit length is sent alongside — that one
        // is validated against the same maximum below.
        if (durationMinutes === undefined && !servicesFitOneAppointment(newServices)) {
            return Response.json(
                { error: 'Those services are too long for one appointment' },
                { status: 400 }
            )
        }
    }

    // What the appointment costs after this request — a discount is checked
    // against this, so "add a service and take $10 off" works in one go.
    const priceCents = servicesPriceCents(newServices ?? appointment.services)

    // Discount: same three-way convention as the other optional fields here
    // — undefined = don't touch, null = remove it, { type, value } = set it.
    // Judged against the appointment's *current* status, so it can ride
    // along with the checkout request itself ("10% off, paid by card") but
    // can't be changed once the appointment is completed (the receipt has
    // already gone out) or was cancelled / a no-show (nothing was owed).
    let parsedDiscount: { type: DiscountType; value: number } | null | undefined = undefined
    if (discount !== undefined) {
        if (appointment.status !== AppointmentStatus.PENDING && appointment.status !== AppointmentStatus.CONFIRMED) {
            return Response.json(
                { error: 'A discount can only be changed on a PENDING or CONFIRMED appointment' },
                { status: 400 }
            )
        }

        if (discount === null) {
            parsedDiscount = null
        } else {
            if (typeof discount !== 'object') {
                return Response.json(
                    { error: 'discount must be { type, value } or null' },
                    { status: 400 }
                )
            }

            const { type, value } = discount as Record<string, unknown>
            const problem = discountError({ type, value }, priceCents)
            if (problem) {
                return Response.json(
                    { error: problem },
                    { status: 400 }
                )
            }

            parsedDiscount = { type: type as DiscountType, value: value as number }
        }
    }

    // Reschedule: admin-only (this whole route already is), same artist —
    // only the time moves. A different artist is really "cancel and
    // rebook," not a reschedule, and is deliberately out of scope here (see
    // FEATURE_GAPS.md Gap 4). Not folded into bookOccurrence()
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
        if (resultingStatus !== AppointmentStatus.PENDING && resultingStatus !== AppointmentStatus.CONFIRMED) {
            return Response.json(
                { error: 'Only a PENDING or CONFIRMED appointment can be rescheduled' },
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

    // Length override: some clients take longer (or less time) than the
    // service's usual duration, so an admin can set this one appointment's
    // length directly. Same gate as a reschedule — it re-claims slots, so it
    // only makes sense while the appointment is still PENDING or CONFIRMED.
    let parsedDuration: number | null = null
    if (durationMinutes !== undefined) {
        const resultingStatus = (status as AppointmentStatus | undefined) ?? appointment.status
        if (resultingStatus !== AppointmentStatus.PENDING && resultingStatus !== AppointmentStatus.CONFIRMED) {
            return Response.json(
                { error: "Only a PENDING or CONFIRMED appointment's length can be changed" },
                { status: 400 }
            )
        }

        if (!isValidAppointmentLength(durationMinutes)) {
            return Response.json(
                { error: `durationMinutes must be a multiple of 15, from 15 to ${MAX_APPOINTMENT_MINUTES}` },
                { status: 400 }
            )
        }

        parsedDuration = durationMinutes
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

            if (parsedDiscount !== undefined) {
                data.discountType = parsedDiscount?.type ?? null
                data.discountValue = parsedDiscount?.value ?? null
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

            if (newServices) {
                // Replace the whole list rather than diffing it — it's at
                // most a handful of rows, and the order may have changed.
                await tx.appointmentService.deleteMany({ where: { appointmentId: id } })
                await tx.appointmentService.createMany({
                    data: newServices.map((service, position) => ({ ...service, appointmentId: id, position })),
                })
            }

            if (parsedStartTime || parsedDuration !== null || newServices) {
                // Start: unchanged unless sent. Length: an explicit one wins;
                // otherwise changing the services resets it to their usual
                // combined length (an earlier override was for the old
                // services); otherwise it stays the appointment's own — a
                // reschedule must not silently undo a length an admin set
                // for this client.
                const minutes =
                    parsedDuration ??
                    (newServices ? servicesDurationMinutes(newServices) : durationMinutesOf(appointment))

                // Throws SlotUnavailableError (rolling back the whole
                // transaction, services included) if the new span isn't open.
                // allowPast: this route is admin-only.
                const span = await reclaimSlots(tx, {
                    appointmentId: id,
                    artistId: appointment.artistId,
                    startTime: parsedStartTime ?? appointment.startTime,
                    durationMinutes: minutes,
                    allowPast: true,
                })

                data.startTime = span.startTime
                data.endTime = span.endTime
                if (parsedStartTime) {
                    // Any reminder already sent was for the old time — clear
                    // it so the job reminds about the new one. (A length-only
                    // change leaves the start, and so the reminder, as is.)
                    data.reminderSentAt = null
                }
            }

            // With its service lines, so the schedule grid can merge the
            // response straight into what it's showing.
            return tx.appointment.update({
                where: { id },
                data,
                include: SERVICE_LINES_INCLUDE,
            })
        })

        // Customer emails, scheduled after the response — each only on an
        // actual transition, so re-sending the same status (e.g. re-marking a
        // completed appointment complete to fix its payment method) doesn't
        // re-send. CONFIRMED and NO_SHOW are internal bookkeeping and send
        // nothing: the customer already got a booking confirmation, and a
        // no-show email isn't something a salon would want automated.
        if (status === AppointmentStatus.CANCELLED && appointment.status !== AppointmentStatus.CANCELLED) {
            after(() => sendCancellationNotice(id, "salon"))
        }
        if (status === AppointmentStatus.COMPLETED && appointment.status !== AppointmentStatus.COMPLETED) {
            after(() => sendReceipt(id))
        }
        if (parsedStartTime && parsedStartTime.getTime() !== appointment.startTime.getTime()) {
            const previousStartTime = appointment.startTime
            after(() => sendRescheduleNotice(id, previousStartTime))
        }

        return Response.json({ data: updated }, { status: 200 })
    } catch (error) {
        if (error instanceof SlotUnavailableError) {
            return Response.json(
                {
                    error: parsedStartTime
                        ? 'That time is not available'
                        : newServices && parsedDuration === null
                          ? "There isn't enough open time after this appointment for those services"
                          : "There isn't enough open time after this appointment for that length",
                },
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
