import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { AppointmentStatus, Prisma } from "@/generated/prisma/client";
import { NextRequest } from "next/server";
import { endOfDay } from "@/lib/availability";
import { parseLocalDate } from "@/lib/format";

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
        const parsed = parseLocalDate(startDate)

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
        const parsed = parseLocalDate(endDate)

        if (!parsed) {
            return Response.json(
                { error: "End date is invalid" },
                { status: 400 }
            )
        }

        endBound = endOfDay(parsed)
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