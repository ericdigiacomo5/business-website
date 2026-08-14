import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma"
import { isGridAligned, isValidTimeString } from "@/lib/availability";
import { Prisma } from "@/generated/prisma/client";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const timeOff = await prisma.timeOff.findUnique({
        where: { id }
    })

    if (!timeOff) {
        return Response.json(
            { error: "Time off not found" },
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

    const { artistId, date, startTime, endTime } = body as Record<string, unknown>

    if (artistId !== undefined && typeof artistId !== 'string') {
        return Response.json(
            { error: 'Artist is invalid' },
            { status: 400 }
        )
    }

    if (artistId !== undefined) {
        const artist = await prisma.artist.findUnique({
            where: { id: artistId }
        })

        if (!artist) {
            return Response.json(
                { error: 'Artist not found' },
                { status: 404 }
            )
        }
    }

    if (date !== undefined && typeof date !== 'string') {
        return Response.json(
            { error: 'Date is invalid' },
            { status: 400 }
        )
    }

    let parsedDate: Date | undefined
    if (date !== undefined) {
        const [year, month, day] = date.split('-').map(Number)
        parsedDate = new Date(year, month - 1, day)
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
    }

    if (
        startTime !== undefined &&
        (typeof startTime !== 'string' ||
            !isValidTimeString(startTime) ||
            !isGridAligned(startTime))
    ) {
        return Response.json(
            { error: 'Start time must be a valid HH:mm time on a 15-minute boundary' },
            { status: 400 }
        )
    }

    if (
        endTime !== undefined &&
        (typeof endTime !== 'string' ||
            !isValidTimeString(endTime) ||
            !isGridAligned(endTime))
    ) {
        return Response.json(
            { error: 'End time must be a valid HH:mm time on a 15-minute boundary' },
            { status: 400 }
        )
    }

    const start = startTime !== undefined ? startTime : timeOff.startTime
    const end = endTime !== undefined ? endTime : timeOff.endTime
    if (start >= end) {
        return Response.json(
            { error: 'Start time must be before end time' },
            { status: 400 }
        )
    }

    const effectiveArtistId = artistId !== undefined ? artistId : timeOff.artistId
    const effectiveDate = parsedDate !== undefined ? parsedDate : timeOff.date

    const dayStart = new Date(effectiveDate.getFullYear(), effectiveDate.getMonth(), effectiveDate.getDate())
    const dayEnd = new Date(effectiveDate.getFullYear(), effectiveDate.getMonth(), effectiveDate.getDate(), 23, 59, 59, 999)

    const priorTimeOff = await prisma.timeOff.findMany({
        where: {
            id: { not: timeOff.id },
            artistId: effectiveArtistId,
            date: { gte: dayStart, lte: dayEnd }
        }
    })

    const isOverlapping = priorTimeOff.some((t) => {
        return t.startTime < end && start < t.endTime
    })

    if (isOverlapping) {
        return Response.json(
            { error: 'Time off is overlapping' },
            { status: 400 }
        )
    }

    const data: Record<string, unknown> = {}
    if (artistId !== undefined) data.artistId = artistId;
    if (parsedDate !== undefined) data.date = parsedDate;
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;

    try {
        const updatedTimeOff = await prisma.timeOff.update({
            where: { id: timeOff.id },
            data: data
        })

        return Response.json({ data: updatedTimeOff }, { status: 200 })
    } catch (error) {
        // Race between the findUnique above and this update — e.g. the row
        // was removed in between. Same pattern as admin/availability/[id].
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: 'Time off not found' },
                { status: 404 }
            )
        }

        throw error
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const timeOff = await prisma.timeOff.findUnique({
        where: { id }
    })

    if (!timeOff) {
        return Response.json(
            { error: 'Time off not found' },
            { status: 404 }
        )
    }

    try {
        const deleted = await prisma.timeOff.delete({
            where: { id: timeOff.id }
        })

        return Response.json({ data: deleted }, { status: 200 })
    } catch (error) {

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: 'Time off not found' },
                { status: 404 }
            )
        }

        throw error
    }
}