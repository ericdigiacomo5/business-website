import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getOpenDays } from "@/lib/availability"
import { MAX_APPOINTMENT_MINUTES } from "@/lib/schedule-grid"
import { ADMIN_DAYS_AHEAD } from "@/lib/recurring"
import { allowedExcludeAppointmentId } from "@/lib/exclude-appointment"

// GET /api/artists/:id/open-days?durationMinutes=60&days=14
//
// Which of the next `days` days (from today) have at least one time where a
// visit of that length fits, each with its first such time — so the booking
// strip can grey out full days and offer "Next opening" instead of a dead
// end (FEATURE_GAPS.md U6). Public, like the per-day availability route: it
// reveals nothing that route doesn't. One request for the whole strip
// instead of one per day.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: artistId } = await params
    const search = request.nextUrl.searchParams

    // Any whole number of minutes: services aren't required to be multiples
    // of 15 (a visit then takes the slots it overlaps, as at booking).
    const durationMinutes = Number(search.get("durationMinutes"))
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > MAX_APPOINTMENT_MINUTES) {
        return Response.json({ error: "Duration is invalid" }, { status: 400 })
    }

    // Up to the admin reschedule picker's reach; customers ask for 14.
    const days = Number(search.get("days") ?? 14)
    if (!Number.isInteger(days) || days < 1 || days > ADMIN_DAYS_AHEAD) {
        return Response.json({ error: `Days must be 1 to ${ADMIN_DAYS_AHEAD}` }, { status: 400 })
    }

    const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true, active: true } })
    if (!artist || !artist.active) {
        return Response.json({ error: "Artist not found" }, { status: 404 })
    }

    const excludeAppointmentId = await allowedExcludeAppointmentId(request)
    const openDays = await getOpenDays(artist.id, new Date(), days, durationMinutes, { excludeAppointmentId })

    return Response.json({
        data: openDays.map((day) => ({ date: day.dateKey, firstStart: day.firstStart.toISOString() })),
    })
}
