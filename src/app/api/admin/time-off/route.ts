import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma"
import { isValidTimeString, isGridAligned } from "@/lib/availability"

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

    const { artistId, date, startTime, endTime } = body as Record<string, unknown>

    if (!artistId || typeof artistId !== 'string') {
        return Response.json(
            { error: 'Artist is required' },
            { status: 400 }
        )
    }

    const artist = await prisma.artist.findUnique({
        where: { id: artistId }
    })

    if (!artist) {
        return Response.json(
            { error: 'Artist not found' },
            { status: 404 }
        )
    }

    if (typeof date !== 'string') {
        return Response.json(
            { error: 'Date is required' },
            { status: 400 }
        )
    }

    const [year, month, day] = date.split('-').map(Number)
    const parsedDate = new Date(year, month - 1, day)
    const isValidDate =
        parsedDate.getFullYear() === year &&
        parsedDate.getMonth() === month - 1 &&
        parsedDate.getDate() === day

    if (!isValidDate) {
        return Response.json(
            { error: 'Date is invalid' },
            { status: 400 }
        )
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

    const dayStart = new Date(year, month - 1, day)
    const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999)

    const priorTimeOff = await prisma.timeOff.findMany({
        where: { artistId: artistId, date: { gte: dayStart, lte: dayEnd } }
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
            artistId: artistId,
            date: parsedDate,
            startTime: startTime,
            endTime: endTime
        }
    })

    return Response.json({ data: timeOff }, { status: 201 })
}