import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookOccurrence, loadServicesToBook } from "@/lib/booking";
import { parseServiceIds, servicesFitOneAppointment } from "@/lib/appointment-services";
import { sendBookingConfirmation } from "@/lib/appointment-emails";
import { BOOKING_WINDOW_DAYS, bookingWindowEnd } from "@/lib/recurring";
import { auth } from "@/auth";
import { isBookingEnabled } from "@/lib/settings";
import { readJsonObject } from "@/lib/request";
import { PROFILE_INCOMPLETE_MESSAGE } from "@/lib/validation";
import { isValidAppointmentLength, MAX_APPOINTMENT_MINUTES } from "@/lib/schedule-grid";

export async function POST(request: Request) {
    const session = await auth()
    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    const isAdmin = session.user.role === "ADMIN"

    // Admins always bypass the toggle — it exists to stop customer
    // self-booking (e.g. fully booked out, between seasons), not to stop
    // staff from booking appointments on the phone/in person.
    if (!isAdmin && !(await isBookingEnabled())) {
        return Response.json(
            { error: "Online booking is currently closed. Please contact the salon directly." },
            { status: 403 }
        )
    }

    // A customer booking for themselves needs a name and a real phone number
    // on file (Google sign-ups and older accounts may lack them). Admins
    // booking on someone's behalf aren't blocked by their own profile.
    if (!isAdmin && session.user.profileIncomplete) {
        return Response.json({ error: PROFILE_INCOMPLETE_MESSAGE }, { status: 403 })
    }

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const { artistId, serviceIds: requestedServiceIds, startTime, userId: requestedUserId, durationMinutes } = body

    // Only an admin's requested target user is honored — a non-admin's
    // userId is silently ignored (not rejected) so the customer-facing
    // contract is unchanged; isAdmin comes from the session, never from
    // this body, so a spoofed userId can't grant a spoofed override either.
    let targetUserId = session.user.id
    if (isAdmin && typeof requestedUserId === 'string' && requestedUserId) {
        targetUserId = requestedUserId
    }

    // Same rule for the length override: only an admin can book a length
    // other than the services' usual one; a non-admin's durationMinutes is
    // ignored, never honored.
    let lengthOverride: number | null = null
    if (isAdmin && durationMinutes !== undefined && durationMinutes !== null) {
        if (!isValidAppointmentLength(durationMinutes)) {
            return Response.json(
                { error: `durationMinutes must be a multiple of 15, from 15 to ${MAX_APPOINTMENT_MINUTES}` },
                { status: 400 }
            )
        }
        lengthOverride = durationMinutes
    }

    if (typeof artistId !== 'string' || !artistId) {
        return Response.json(
            { error: 'Artist is required' },
            { status: 400 }
        )
    }

    // One or more services, in the order they'll appear on the appointment.
    const serviceIds = parseServiceIds(requestedServiceIds)
    if (typeof serviceIds === 'string') {
        return Response.json(
            { error: serviceIds },
            { status: 400 }
        )
    }

    if (typeof startTime !== 'string' && typeof startTime !== 'number') {
        return Response.json(
            { error: 'Time is required' },
            { status: 400 }
        )
    }

    const parsedStartTime = new Date(startTime)
    const isOnSlotGrid =
        parsedStartTime.getMinutes() % 15 === 0 &&
        parsedStartTime.getSeconds() === 0 &&
        parsedStartTime.getMilliseconds() === 0
    const isInPast = parsedStartTime.getTime() < Date.now()
    if (isNaN(parsedStartTime.getTime()) || !isOnSlotGrid || (!isAdmin && isInPast)) {
        return Response.json(
            { error: 'Time is invalid' },
            { status: 400 }
        )
    }

    // The booking window is enforced here, not just by the UI's 14-day day
    // strip, so a direct API call can't book further ahead than the wizard
    // allows. Admins are exempt (same latitude as past-time booking above).
    if (!isAdmin && parsedStartTime.getTime() >= bookingWindowEnd().getTime()) {
        return Response.json(
            { error: `You can book up to ${BOOKING_WINDOW_DAYS} days in advance` },
            { status: 400 }
        )
    }

    const [artist, services, user] = await Promise.all([
        prisma.artist.findUnique({ where: { id: artistId } }),
        loadServicesToBook(serviceIds, { requireActive: true }),
        prisma.user.findUnique({ where: { id: targetUserId } }),
    ])

    // 404s match every other route's existence checks (this route used 400
    // until 2026-10-16).
    if (!artist) {
        return Response.json(
            { error: 'Artist not found' },
            { status: 404 }
        )
    }

    // A deactivated artist can't be booked by anyone, admins included — the
    // toggle above only gates whether booking is open at all, this is a
    // separate "this specific artist isn't bookable" check. The client is
    // expected to already filter deactivated artists out of any picker, but
    // this is the actual enforcement boundary — never trust that alone.
    if (!artist.active) {
        return Response.json(
            { error: 'Artist not found' },
            { status: 404 }
        )
    }

    if (!services) {
        return Response.json(
            { error: 'Service not found' },
            { status: 404 }
        )
    }

    // Only matters without an admin length override, which is validated
    // against the same maximum above.
    if (lengthOverride === null && !servicesFitOneAppointment(services)) {
        return Response.json(
            { error: 'Those services are too long for one appointment' },
            { status: 400 }
        )
    }

    if (!user) {
        return Response.json(
            { error: 'User not found' },
            { status: 404 }
        )
    }

    const result = await bookOccurrence({
        userId: targetUserId,
        artistId,
        services,
        durationMinutes: lengthOverride ?? undefined,
        startTime: parsedStartTime,
        allowPast: isAdmin,
    })

    if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status })
    }

    // after(), not awaited — the booking has already committed, so the
    // response shouldn't wait on (or fail because of) the email. Sent from
    // here, not from bookOccurrence(), because the recurring route calls
    // that once per occurrence and sends its own single summary instead.
    after(() => sendBookingConfirmation(result.appointment.id))

    return Response.json({ data: result.appointment }, { status: 201 });
}
