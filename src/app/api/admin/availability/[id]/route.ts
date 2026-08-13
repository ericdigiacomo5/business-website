import { isGridAligned, isValidTimeString } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/require-admin";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const availability = await prisma.availability.findUnique({
        where: { id }
    })

    if (!availability) {
        return Response.json(
            { error: "Availability not found" },
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

    const { dayOfWeek, startTime, endTime } = body as Record<string, unknown>

    if (dayOfWeek !== undefined && (typeof dayOfWeek !== 'number' || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
        return Response.json(
            { error: "Day of week must be an integer between 0 and 6" },
            { status: 400 }
        )
    }

    if (
        startTime !== undefined &&
        (typeof startTime !== 'string' ||
            !isValidTimeString(startTime) ||
            !isGridAligned(startTime))
    ) {
        return Response.json(
            { error: "Start time must be a valid HH:mm time on a 15-minute boundary" },
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
            { error: "End time must be a valid HH:mm time on a 15-minute boundary" },
            { status: 400 }
        )
    }

    const start = startTime !== undefined ? startTime : availability.startTime
    const end = endTime !== undefined ? endTime : availability.endTime
    if (start >= end) {
        return Response.json(
            { error: "Start time must be before end time" },
            { status: 400 }
        )
    }

    const priorAvailabilities = await prisma.availability.findMany({
        where: {
            id: { not: availability.id },
            artistId: availability.artistId,
            dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : availability.dayOfWeek
        }
    })

    const isOverlapping = priorAvailabilities.some((a) => {
        return a.startTime < end && start < a.endTime
    })

    if (isOverlapping) {
        return Response.json(
            { error: "Availability is overlapping" },
            { status: 400 }
        )
    }

    const data: Record<string, unknown> = {}
    if (dayOfWeek !== undefined) data.dayOfWeek = dayOfWeek;
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;

    try {
        const updatedAvailability = await prisma.availability.update({
            where: { id: availability.id },
            data: data
        })

        return Response.json({ data: updatedAvailability }, { status: 200 })
    } catch (error) {
        // Race between the findUnique above and this update — e.g. the row
        // was removed in between. Same pattern as admin/services/[id].
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: "Availability not found" },
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

    const availability = await prisma.availability.findUnique({
        where: { id }
    })

    if (!availability) {
        return Response.json(
            { error: "Availability not found" },
            { status: 404 }
        )
    }

    try {
        await prisma.availability.delete({
            where: { id: availability.id },
        })

        return Response.json({ data: availability }, { status: 200 })
    } catch (error) {

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: 'Availability not found' },
                { status: 404 }
            )
        }

        throw error
    }

}