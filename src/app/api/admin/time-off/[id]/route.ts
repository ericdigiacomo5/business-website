import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma"
import { isGridAligned, isValidTimeString, startOfDay, endOfDay, timeOffDateRangeOverlap } from "@/lib/availability";
import { parseLocalDate } from "@/lib/format";
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

    const { artistId, date, endDate, startTime, endTime } = body as Record<string, unknown>

    // Three-way, same convention admin/services's PATCH established for
    // Service.description: undefined = don't touch, null = clear it (make
    // salon-wide), a string = set/change it. Only validated against a real
    // Artist when a specific one is actually being set.
    if (artistId !== undefined && artistId !== null && typeof artistId !== 'string') {
        return Response.json(
            { error: 'Artist is invalid' },
            { status: 400 }
        )
    }

    if (typeof artistId === 'string') {
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
        const parsed = parseLocalDate(date)

        if (!parsed) {
            return Response.json(
                { error: 'Date is invalid' },
                { status: 400 }
            )
        }

        parsedDate = parsed
    }

    // Same three-way convention as artistId: undefined = don't touch,
    // null = clear it (make single-day again), a string = set/change it.
    let parsedEndDate: Date | null | undefined = undefined
    if (endDate !== undefined) {
        if (endDate === null) {
            parsedEndDate = null
        } else if (typeof endDate !== 'string') {
            return Response.json(
                { error: 'End date is invalid' },
                { status: 400 }
            )
        } else {
            const parsed = parseLocalDate(endDate)
            if (!parsed) {
                return Response.json(
                    { error: 'End date is invalid' },
                    { status: 400 }
                )
            }
            parsedEndDate = parsed
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

    const effectiveArtistId: string | null = artistId !== undefined ? (artistId as string | null) : timeOff.artistId
    const effectiveDate = parsedDate !== undefined ? parsedDate : timeOff.date
    const effectiveEndDate = parsedEndDate !== undefined ? parsedEndDate : timeOff.endDate

    if (effectiveEndDate && effectiveEndDate.getTime() < effectiveDate.getTime()) {
        return Response.json(
            { error: 'End date must be on or after the start date' },
            { status: 400 }
        )
    }

    const dayStart = startOfDay(effectiveDate)
    const dayEnd = endOfDay(effectiveEndDate ?? effectiveDate)

    // Same widening as POST: the artist condition is dropped entirely when
    // the row ends up salon-wide (effectiveArtistId is null), since it must
    // then be checked against every existing row regardless of artist — see
    // that route's own comment for the full reasoning. The date-range
    // overlap spans this row's whole effective range, not just its start day.
    const priorTimeOff = await prisma.timeOff.findMany({
        where: {
            AND: [
                { id: { not: timeOff.id } },
                effectiveArtistId ? { OR: [{ artistId: effectiveArtistId }, { artistId: null }] } : {},
                timeOffDateRangeOverlap(dayStart, dayEnd),
            ],
        },
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
    if (parsedEndDate !== undefined) data.endDate = parsedEndDate;
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