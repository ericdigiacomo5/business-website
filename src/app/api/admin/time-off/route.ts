import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma"
import { isValidTimeString, isGridAligned, startOfDay, endOfDay, timeOffDateRangeOverlap } from "@/lib/availability"
import { parseLocalDate } from "@/lib/format"

export async function POST(request: Request) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

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

    const { artistId, date, endDate, startTime, endTime } = body as Record<string, unknown>

    // artistId is optional — omitted (or explicitly null) means salon-wide,
    // blocking every artist including ones created after this row (see
    // PLAN_SALON_CLOSURES.md). Only validated against a real Artist when a
    // specific one is actually being targeted.
    if (artistId !== undefined && artistId !== null && typeof artistId !== 'string') {
        return Response.json(
            { error: 'Artist is invalid' },
            { status: 400 }
        )
    }

    const targetArtistId = (typeof artistId === 'string' && artistId) ? artistId : null

    if (targetArtistId) {
        const artist = await prisma.artist.findUnique({
            where: { id: targetArtistId }
        })

        if (!artist) {
            return Response.json(
                { error: 'Artist not found' },
                { status: 404 }
            )
        }
    }

    if (typeof date !== 'string') {
        return Response.json(
            { error: 'Date is required' },
            { status: 400 }
        )
    }

    const parsedDate = parseLocalDate(date)

    if (!parsedDate) {
        return Response.json(
            { error: 'Date is invalid' },
            { status: 400 }
        )
    }

    // endDate is optional — omitted (or null) means a single-day entry,
    // unchanged from before. A value makes this a multi-day range
    // [date, endDate] inclusive.
    let parsedEndDate: Date | null = null
    if (endDate !== undefined && endDate !== null) {
        if (typeof endDate !== 'string') {
            return Response.json(
                { error: 'End date is invalid' },
                { status: 400 }
            )
        }

        const parsed = parseLocalDate(endDate)
        if (!parsed) {
            return Response.json(
                { error: 'End date is invalid' },
                { status: 400 }
            )
        }

        if (parsed.getTime() < parsedDate.getTime()) {
            return Response.json(
                { error: 'End date must be on or after the start date' },
                { status: 400 }
            )
        }

        parsedEndDate = parsed
    }

    if (
        typeof startTime !== 'string' ||
        !isValidTimeString(startTime) ||
        !isGridAligned(startTime)
    ) {
        return Response.json(
            { error: 'Start time must be a valid HH:mm time on a 15-minute boundary' },
            { status: 400 }
        )
    }

    if (
        typeof endTime !== 'string' ||
        !isValidTimeString(endTime) ||
        !isGridAligned(endTime)
    ) {
        return Response.json(
            { error: 'End time must be a valid HH:mm time on a 15-minute boundary' },
            { status: 400 }
        )
    }

    if (startTime >= endTime) {
        return Response.json(
            { error: 'Start time must be before end time' },
            { status: 400 }
        )
    }

    const dayStart = startOfDay(parsedDate)
    const dayEnd = endOfDay(parsedEndDate ?? parsedDate)

    // Widened in both directions a plain artistId-and-single-day check would
    // miss: (1) the artist condition is dropped entirely when creating a
    // salon-wide row (targetArtistId === null) — it must be checked against
    // every existing row regardless of artist, since a salon-wide closure
    // landing on a day an individual artist already has personal time off is
    // still a real overlap worth flagging (redundant, not harmful, but
    // confusing data if silently allowed to stack); when creating a
    // per-artist row, only that artist's rows and existing salon-wide rows
    // are relevant. (2) The check spans this new row's whole range, not just
    // its start day, so a multi-day entry can't silently collide with
    // something in its middle. Same date-overlap shape as getOpenSlots's
    // query, for the same reason.
    const priorTimeOff = await prisma.timeOff.findMany({
        where: {
            AND: [
                targetArtistId ? { OR: [{ artistId: targetArtistId }, { artistId: null }] } : {},
                timeOffDateRangeOverlap(dayStart, dayEnd),
            ],
        },
    })

    const isOverlapping = priorTimeOff.some((t) => {
        return t.startTime < endTime && startTime < t.endTime
    })

    if (isOverlapping) {
        return Response.json(
            { error: 'Time off is overlapping' },
            { status: 400 }
        )
    }

    const timeOff = await prisma.timeOff.create({
        data: {
            artistId: targetArtistId,
            date: parsedDate,
            endDate: parsedEndDate,
            startTime: startTime,
            endTime: endTime
        }
    })

    return Response.json({ data: timeOff }, { status: 201 })
}