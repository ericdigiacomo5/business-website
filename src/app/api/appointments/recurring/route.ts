import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendRecurringConfirmation } from "@/lib/appointment-emails";
import { isGridAligned, isValidTimeString, timeStringToDate } from "@/lib/availability";
import { addDays, BOOKING_WINDOW_DAYS, bookingWindowEnd, materializationHorizon } from "@/lib/recurring";
import { materializeSeries } from "@/lib/booking";
import { parseLocalDate } from "@/lib/format";
import { isBookingEnabled } from "@/lib/settings";

export async function POST(request: Request) {
    const session = await auth()
    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    const isAdmin = session.user.role === "ADMIN"

    // Same toggle enforcement as the one-off booking route — admins always
    // bypass it, since it exists to stop customer self-booking, not staff.
    if (!isAdmin && !(await isBookingEnabled())) {
        return Response.json(
            { error: "Online booking is currently closed. Please contact the salon directly." },
            { status: 403 }
        )
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return Response.json(
            { error: 'Invalid JSON body' },
            { status: 400 }
        )
    }

    if (typeof body !== 'object' || body === null) {
        return Response.json(
            { error: 'Invalid request body' },
            { status: 400 }
        )
    }

    const { artistId, serviceId, dayOfWeek, startTime, intervalWeeks, seriesStart, seriesEnd, userId: requestedUserId } = body as Record<string, unknown>

    // Same admin-override rule as the one-off booking route: a non-admin's
    // userId is silently ignored, not rejected, so the customer contract is
    // unchanged; isAdmin comes only from the session, never this body.
    let targetUserId = session.user.id
    if (isAdmin && typeof requestedUserId === "string" && requestedUserId) {
        targetUserId = requestedUserId
    }

    if (!artistId || typeof artistId !== "string") {
        return Response.json(
            { error: "Artist is required" },
            { status: 400 }
        )
    }

    if (!serviceId || typeof serviceId !== "string") {
        return Response.json(
            { error: "Service is required" },
            { status: 400 }
        )
    }

    if (typeof dayOfWeek !== "number" || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return Response.json(
            { error: "Day of week must be an integer 0-6" },
            { status: 400 }
        )
    }

    if (typeof startTime !== "string" || !isValidTimeString(startTime) || !isGridAligned(startTime)) {
        return Response.json(
            { error: "Start time must be a valid HH:mm time on a 15-minute boundary" },
            { status: 400 }
        )
    }

    if (typeof intervalWeeks !== "number" || !Number.isInteger(intervalWeeks) || intervalWeeks < 1) {
        return Response.json(
            { error: "Interval must be a positive integer number of weeks" },
            { status: 400 }
        )
    }

    if (typeof seriesStart !== "string") {
        return Response.json(
            { error: "Series start date is required" },
            { status: 400 }
        )
    }

    const parsedSeriesStart = parseLocalDate(seriesStart)
    if (!parsedSeriesStart) {
        return Response.json(
            { error: "Series start date is invalid" },
            { status: 400 }
        )
    }

    if (parsedSeriesStart.getDay() !== dayOfWeek) {
        return Response.json(
            { error: "Series start date does not fall on the given day of week" },
            { status: 400 }
        )
    }

    let parsedSeriesEnd: Date | null = null
    if (seriesEnd !== undefined && seriesEnd !== null) {
        if (typeof seriesEnd !== "string") {
            return Response.json(
                { error: "Series end date is invalid" },
                { status: 400 }
            )
        }

        parsedSeriesEnd = parseLocalDate(seriesEnd)
        if (!parsedSeriesEnd) {
            return Response.json(
                { error: "Series end date is invalid" },
                { status: 400 }
            )
        }

        if (parsedSeriesEnd.getTime() < parsedSeriesStart.getTime()) {
            return Response.json(
                { error: "Series end date must be on or after the series start date" },
                { status: 400 }
            )
        }
    }

    // Same admin exemption as the one-off booking route (see FEATURE_GAPS.md
    // Gap 3) — an admin backdating a series' start lets a standing
    // appointment be recorded as if it began in the past, e.g. entering a
    // recurring walk-in relationship that already started off-system.
    const firstOccurrenceStart = timeStringToDate(parsedSeriesStart, startTime)
    if (!isAdmin && firstOccurrenceStart.getTime() < Date.now()) {
        return Response.json(
            { error: "Series start time is in the past" },
            { status: 400 }
        )
    }

    // Same booking window as the one-off route, applied to the first
    // occurrence only — the series itself is what's allowed to reach past
    // the window (that's the point of a standing appointment).
    if (!isAdmin && firstOccurrenceStart.getTime() >= bookingWindowEnd().getTime()) {
        return Response.json(
            { error: `A standing appointment must start within the next ${BOOKING_WINDOW_DAYS} days` },
            { status: 400 }
        )
    }

    const [artist, service, targetUser] = await Promise.all([
        prisma.artist.findUnique({ where: { id: artistId } }),
        prisma.service.findUnique({ where: { id: serviceId } }),
        prisma.user.findUnique({ where: { id: targetUserId } }),
    ])

    if (!artist) {
        return Response.json(
            { error: "Artist not found" },
            { status: 404 }
        )
    }

    // Same rule as the one-off booking route: no one, admins included, can
    // book (even a standing appointment) with a deactivated artist.
    if (!artist.active) {
        return Response.json(
            { error: "Artist not found" },
            { status: 404 }
        )
    }

    if (!service) {
        return Response.json(
            { error: "Service not found" },
            { status: 404 }
        )
    }

    if (!targetUser) {
        return Response.json(
            { error: "User not found" },
            { status: 404 }
        )
    }

    const recurringAppointment = await prisma.recurringAppointment.create({
        data: {
            userId: targetUserId,
            artistId,
            serviceId,
            dayOfWeek,
            startTime,
            intervalWeeks,
            seriesStart: parsedSeriesStart,
            seriesEnd: parsedSeriesEnd,
        },
    })

    // Same shared materializer the daily job and Resume use, so all three
    // agree on occurrence identity and skip handling. Creation-time skips
    // are persisted too, so they stay visible on the series afterward.
    // allowPast: an admin backdating a series (Gap 3) can still record
    // weeks that already happened; the job and Resume never can.
    const now = new Date()
    const materialization = await materializeSeries(recurringAppointment.id, {
        fromDateExclusive: addDays(parsedSeriesStart, -1),
        now,
        allowPast: isAdmin,
    })
    const updatedSeries = await prisma.recurringAppointment.update({
        where: { id: recurringAppointment.id },
        data: { materializedThrough: materializationHorizon(now) },
    })

    const created = await prisma.appointment.findMany({
        where: { id: { in: materialization.created.map((c) => c.appointmentId) } },
        orderBy: { startTime: "asc" },
    })
    // Same { date, reason } shape this route has always returned, so the
    // booking wizard's review/confirmed steps need no change.
    const skipped = materialization.skipped.map((s) => ({ date: s.occurrenceDate, reason: s.reason }))

    // One summary email for the whole series — not one per occurrence.
    const createdIds = created.map((a) => a.id)
    const skippedStartTimes = materialization.skipped.map((s) => s.startTime)
    after(() => sendRecurringConfirmation(recurringAppointment.id, createdIds, skippedStartTimes))

    return Response.json(
        { data: { recurringAppointment: updatedSeries, created, skipped } },
        { status: 201 }
    )
}
