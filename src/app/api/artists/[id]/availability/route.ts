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

    // Only an admin's excludeAppointmentId is honored — same silently-ignore
    // pattern the booking routes already use for a non-admin's userId
    // override. This route stays public/unauthenticated for the ordinary
    // customer-booking case; the param exists so the admin reschedule UI can
    // show an appointment's own currently-held slots as open (the PATCH
    // route already frees them before checking the new time — hiding them
    // here would make the picker lie about what a reschedule would allow).
    const session = await auth()
    const isAdmin = session?.user?.role === "ADMIN"
    const excludeAppointmentId = isAdmin
        ? request.nextUrl.searchParams.get("excludeAppointmentId") ?? undefined
        : undefined

    const openSlots = await getOpenSlots(artist.id, date, { excludeAppointmentId })

    return Response.json(openSlots)
}
