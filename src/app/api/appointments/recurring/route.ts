import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { isGridAligned, isValidTimeString, startOfDay, timeStringToDate } from "@/lib/availability";
import { generateOccurrenceDates, MATERIALIZE_WEEKS } from "@/lib/recurring";
import { bookOccurrence } from "@/lib/booking";
import { toLocalDateKey } from "@/lib/format";

// "YYYY-MM-DD" in local time, with round-trip validation — same pattern as
// admin/time-off and GET /api/artists/:id/availability, factored out here
// since this route needs it for both seriesStart and seriesEnd.
function parseLocalDate(value: string): Date | null {
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;

    const [year, month, day] = parts;
    const parsed = new Date(year, month - 1, day);
    const isValid =
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day;

    return isValid ? parsed : null;
}

export async function POST(request: Request) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

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

    const { artistId, serviceId, dayOfWeek, startTime, intervalWeeks, seriesStart, seriesEnd } = body as Record<string, unknown>

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

    const [artist, service] = await Promise.all([
        prisma.artist.findUnique({ where: { id: artistId } }),
        prisma.service.findUnique({ where: { id: serviceId } }),
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

    const recurringAppointment = await prisma.recurringAppointment.create({
        data: {
            userId,
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
            userId,
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
