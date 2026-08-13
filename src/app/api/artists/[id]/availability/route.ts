import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getOpenSlots } from "@/lib/availability"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: artistId } = await params

    const dateString = request.nextUrl.searchParams.get("date")

    if (!dateString) {
        return Response.json(
            { error: 'Date is required' },
            { status: 400 }
        )
    }

    // Parse "YYYY-MM-DD" via the multi-arg Date constructor (interpreted in
    // local time) rather than new Date(dateString) — a bare date-only string
    // like "2026-08-04" is parsed as UTC midnight per the JS spec, which can
    // land on the wrong calendar day once shifted into the server's local
    // timezone. Round-trip the parts back out to catch anything that rolled
    // over (e.g. month 13, day 45) instead of silently landing on some other
    // valid-but-wrong date.
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const isValidDate =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day

    if (!isValidDate) {
        return Response.json(
            { error: 'Date is invalid' },
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
        );
    }

    const openSlots = await getOpenSlots(artist.id, date)

    return Response.json(openSlots)
}
