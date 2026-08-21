import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { AppointmentStatus, Prisma } from "@/generated/prisma/client";
import { NextRequest } from "next/server";

// Parses "YYYY-MM-DD" via the multi-arg Date constructor (local time) and
// round-trips the parts to reject overflow (month 13, day 45, etc.) — same
// pattern used by GET /api/artists/:id/availability and admin/time-off.
function parseLocalDate(dateString: string, atEndOfDay: boolean): Date | null {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = atEndOfDay
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day)

    const isValid =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day

    return isValid ? date : null
}

export async function GET(request: NextRequest) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const artistId = request.nextUrl.searchParams.get("artistId")
    const status = request.nextUrl.searchParams.get("status")
    const startDate = request.nextUrl.searchParams.get("startDate")
    const endDate = request.nextUrl.searchParams.get("endDate")

    const where: Prisma.AppointmentWhereInput = {}

    if (artistId) {
        const artist = await prisma.artist.findUnique({ where: { id: artistId } })

        if (!artist) {
            return Response.json(
                { error: "Artist not found" },
                { status: 404 }
            )
        }

        where.artistId = artistId
    }

    if (status) {
        if (!(Object.values(AppointmentStatus) as string[]).includes(status)) {
            return Response.json(
                { error: "Status is invalid" },
                { status: 400 }
            )
        }

        where.status = status as AppointmentStatus
    }

    let startBound: Date | undefined
    if (startDate) {
        const parsed = parseLocalDate(startDate, false)

        if (!parsed) {
            return Response.json(
                { error: "Start date is invalid" },
                { status: 400 }
            )
        }

        startBound = parsed
    }

    let endBound: Date | undefined
    if (endDate) {
        const parsed = parseLocalDate(endDate, true)

        if (!parsed) {
            return Response.json(
                { error: "End date is invalid" },
                { status: 400 }
            )
        }

        endBound = parsed
    }

    if (startBound && endBound && startBound > endBound) {
        return Response.json(
            { error: "Start date must be before end date" },
            { status: 400 }
        )
    }

    if (startBound || endBound) {
        where.startTime = {
            ...(startBound ? { gte: startBound } : {}),
            ...(endBound ? { lte: endBound } : {}),
        }
    }

    const appointments = await prisma.appointment.findMany({
        where,
        orderBy: { startTime: 'asc' }
    })

    return Response.json(appointments)
}