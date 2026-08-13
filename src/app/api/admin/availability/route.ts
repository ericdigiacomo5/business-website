import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { isValidTimeString, isGridAligned } from "@/lib/availability";

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

    const { artistId, dayOfWeek, startTime, endTime } = body as Record<string, unknown>

    if (!artistId || typeof artistId !== 'string') {
        return Response.json(
            { error: "Artist is required" },
            { status: 400 }
        )
    }

    const artist = await prisma.artist.findUnique({
        where: { id: artistId }
    })

    if (!artist) {
        return Response.json(
            { error: "Artist not found" },
            { status: 404 }
        )
    }

    if (dayOfWeek === undefined) {
        return Response.json(
            { error: "Day of the week is required" },
            { status: 400 }
        )
    }

    if (typeof dayOfWeek !== 'number' || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return Response.json(
            { error: "Day of week must be an integer between 0 and 6" },
            { status: 400 }
        )
    }

    if (
        typeof startTime !== 'string' ||
        !isValidTimeString(startTime) ||
        !isGridAligned(startTime)
    ) {
        return Response.json(
            { error: "Start time must be a valid HH:mm time on a 15-minute boundary" },
            { status: 400 }
        )
    }

    if (
        typeof endTime !== 'string' ||
        !isValidTimeString(endTime) ||
        !isGridAligned(endTime)
    ) {
        return Response.json(
            { error: "End time must be a valid HH:mm time on a 15-minute boundary" },
            { status: 400 }
        )
    }

    // Safe to compare as plain strings: both are already confirmed to be
    // zero-padded 24-hour "HH:mm" of identical length, so lexicographic order
    // matches chronological order.
    if (startTime >= endTime) {
        return Response.json(
            { error: "Start time must be before end time" },
            { status: 400 }
        )
    }

    const priorAvailabilities = await prisma.availability.findMany({
        where: { artistId: artistId, dayOfWeek: dayOfWeek }
    })

    // Two ranges overlap iff each one starts before the other ends. Treats
    // ranges as half-open ([start, end)), same as generateSlotsInWindow does
    // elsewhere — a window ending exactly when the next one begins is a
    // shift change, not an overlap.
    const isOverlapping = priorAvailabilities.some((a) => {
        return a.startTime < endTime && startTime < a.endTime
    })

    if (isOverlapping) {
        return Response.json(
            { error: "Availability is overlapping" },
            { status: 400 }
        )
    }

    const availability = await prisma.availability.create({
        data: {
            artistId: artistId,
            dayOfWeek: dayOfWeek,
            startTime: startTime,
            endTime: endTime
        }
    })

    return Response.json({ data: availability }, { status: 201 })
}

