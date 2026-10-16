import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getOpenSlots } from "@/lib/availability"
import { parseLocalDate } from "@/lib/format"
import { auth } from "@/auth"

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

    const date = parseLocalDate(dateString)

    if (!date) {
        return Response.json(
            { error: 'Date is invalid' },
            { status: 400 }
        )
    }

    const artist = await prisma.artist.findUnique({
        where: { id: artistId }
    })

    // A deactivated artist has no bookable time — treated as not found here,
    // same rule GET /api/artists/[id] already applies, so this route can't
    // be used to populate a slot grid for an artist no one should be able to
    // book with.
    if (!artist || !artist.active) {
        return Response.json(
            { error: 'Artist not found' },
            { status: 404 }
        );
    }

    // excludeAppointmentId lets a reschedule picker show an appointment's own
    // currently-held slots as open (the reschedule routes free them before
    // checking the new time — hiding them here would make the picker lie
    // about what a reschedule would allow). Honored only for an admin or for
    // the appointment's own customer; anyone else's is silently ignored,
    // same pattern as a non-admin's userId override on the booking routes.
    // This route stays public/unauthenticated for ordinary browsing, so
    // knowing an appointment id alone mustn't reveal whether it holds slots.
    let excludeAppointmentId: string | undefined
    const requestedExclude = request.nextUrl.searchParams.get("excludeAppointmentId")
    if (requestedExclude) {
        const session = await auth()
        if (session?.user?.role === "ADMIN") {
            excludeAppointmentId = requestedExclude
        } else if (session?.user?.id) {
            const owned = await prisma.appointment.findFirst({
                where: { id: requestedExclude, userId: session.user.id },
                select: { id: true },
            })
            if (owned) excludeAppointmentId = owned.id
        }
    }

    const openSlots = await getOpenSlots(artist.id, date, { excludeAppointmentId })

    return Response.json({ data: openSlots })
}
