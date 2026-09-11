import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isGridAligned, isValidTimeString, startOfDay, timeStringToDate } from "@/lib/availability";
import { generateOccurrenceDates, MATERIALIZE_WEEKS } from "@/lib/recurring";
import { bookOccurrence } from "@/lib/booking";
import { toLocalDateKey, parseLocalDate } from "@/lib/format";
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

    const firstOccurrenceStart = timeStringToDate(parsedSeriesStart, startTime)
    if (firstOccurrenceStart.getTime() < Date.now()) {
        return Response.json(
            { error: "Series start time is in the past" },
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

    const horizonEnd = startOfDay(new Date(Date.now() + MATERIALIZE_WEEKS * 7 * 24 * 60 * 60 * 1000))
    const occurrenceDates = generateOccurrenceDates(parsedSeriesStart, intervalWeeks, horizonEnd, parsedSeriesEnd)

    const created = []
    const skipped: { date: string; reason: string }[] = []

    for (const date of occurrenceDates) {
        const occurrenceStart = timeStringToDate(date, startTime)

        const result = await bookOccurrence({
            userId: targetUserId,
            artistId,
            serviceId,
            serviceDurationMinutes: service.durationMinutes,
            startTime: occurrenceStart,
            recurringAppointmentId: recurringAppointment.id,
        })

        if (result.ok) {
            created.push(result.appointment)
        } else {
            skipped.push({ date: toLocalDateKey(date), reason: result.error })
        }
    }

    return Response.json(
        { data: { recurringAppointment, created, skipped } },
        { status: 201 }
    )
}
