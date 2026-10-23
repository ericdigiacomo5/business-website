import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendRecurringConfirmation } from "@/lib/appointment-emails";
import { isGridAligned, isValidTimeString, timeStringToDate } from "@/lib/availability";
import { BOOKING_WINDOW_DAYS, bookingWindowEnd, maxSeriesEnd } from "@/lib/recurring";
import { customerBookingLimitError, loadServicesToBook, materializeSeries } from "@/lib/booking";
import { customerMaxSeriesWeeks } from "@/lib/booking-limits";
import { parseServiceIds, SERVICE_LINES_INCLUDE, servicesFitOneAppointment } from "@/lib/appointment-services";
import { parseLocalDate } from "@/lib/format";
import { salonWeekday } from "@/lib/salon-time";
import { getPolicySettings, isBookingEnabled } from "@/lib/settings";
import { readJsonObject } from "@/lib/request";
import { EMAIL_UNVERIFIED_MESSAGE, PROFILE_INCOMPLETE_MESSAGE } from "@/lib/validation";
import { artistServicesError } from "@/lib/artist-services-data";

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

    // Same rules as the one-off booking route.
    if (!isAdmin && session.user.profileIncomplete) {
        return Response.json({ error: PROFILE_INCOMPLETE_MESSAGE }, { status: 403 })
    }

    if (!isAdmin && session.user.emailUnverified) {
        return Response.json({ error: EMAIL_UNVERIFIED_MESSAGE }, { status: 403 })
    }

    // One standing appointment per customer online (src/lib/booking-limits.ts).
    if (!isAdmin) {
        const limitError = await customerBookingLimitError(session.user.id, "standing")
        if (limitError) {
            return Response.json({ error: limitError }, { status: 403 })
        }
    }

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const { artistId, serviceIds: requestedServiceIds, dayOfWeek, startTime, intervalWeeks, seriesStart, seriesEnd, userId: requestedUserId } = body

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

    // One or more services — every visit of the series gets all of them.
    const serviceIds = parseServiceIds(requestedServiceIds)
    if (typeof serviceIds === "string") {
        return Response.json(
            { error: serviceIds },
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

    if (salonWeekday(parsedSeriesStart) !== dayOfWeek) {
        return Response.json(
            { error: "Series start date does not fall on the given day of week" },
            { status: 400 }
        )
    }

    // Mandatory for everyone, admins included: the whole series is booked
    // below, in this request, so it has to know where to stop.
    if (typeof seriesEnd !== "string" || !seriesEnd) {
        return Response.json(
            { error: "Series end date is required" },
            { status: 400 }
        )
    }

    const parsedSeriesEnd = parseLocalDate(seriesEnd)
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

    // Applies to admins too: one request books every week, so this bounds
    // how much of a calendar it can claim. Set by the salon in admin
    // settings; customers booking for themselves get a shorter cap on top
    // (CUSTOMER_MAX_SERIES_WEEKS).
    const policy = await getPolicySettings()
    const maxSeriesWeeks = isAdmin ? policy.maxSeriesWeeks : customerMaxSeriesWeeks(policy.maxSeriesWeeks)
    if (parsedSeriesEnd.getTime() > maxSeriesEnd(parsedSeriesStart, maxSeriesWeeks).getTime()) {
        return Response.json(
            { error: `A standing appointment can run for at most ${maxSeriesWeeks} weeks` },
            { status: 400 }
        )
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
    // the window, up to its end date (that's the point of a standing
    // appointment).
    if (!isAdmin && firstOccurrenceStart.getTime() >= bookingWindowEnd().getTime()) {
        return Response.json(
            { error: `A standing appointment must start within the next ${BOOKING_WINDOW_DAYS} days` },
            { status: 400 }
        )
    }

    const [artist, services, targetUser] = await Promise.all([
        prisma.artist.findUnique({ where: { id: artistId } }),
        loadServicesToBook(serviceIds, { requireActive: true }),
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

    if (!services) {
        return Response.json(
            { error: "Service not found" },
            { status: 404 }
        )
    }

    // Same rule as the one-off booking route: customers only, admins may
    // override.
    if (!isAdmin) {
        const notOffered = await artistServicesError(artist, serviceIds)
        if (notOffered) {
            return Response.json(
                { error: notOffered },
                { status: 400 }
            )
        }
    }

    if (!servicesFitOneAppointment(services)) {
        return Response.json(
            { error: "Those services are too long for one appointment" },
            { status: 400 }
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
            dayOfWeek,
            startTime,
            intervalWeeks,
            seriesStart: parsedSeriesStart,
            seriesEnd: parsedSeriesEnd,
            services: {
                create: serviceIds.map((serviceId, position) => ({ serviceId, position })),
            },
        },
    })

    // Books every week through seriesEnd now — nothing extends or re-books
    // a series later. Skips are persisted, so they stay visible on the
    // series afterward. allowPast: an admin backdating a series (Gap 3) can
    // still record weeks that already happened.
    const materialization = await materializeSeries(recurringAppointment.id, { allowPast: isAdmin })

    const created = await prisma.appointment.findMany({
        where: { id: { in: materialization.created.map((c) => c.appointmentId) } },
        include: SERVICE_LINES_INCLUDE,
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
        { data: { recurringAppointment, created, skipped } },
        { status: 201 }
    )
}
