import type { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// Server-only. The public availability routes take an optional
// excludeAppointmentId so a reschedule picker can show an appointment's own
// currently-held slots as open (the reschedule routes free them before
// checking the new time — hiding them would make the picker lie about what a
// reschedule allows). Honored only for an admin or the appointment's own
// customer; anyone else's is silently ignored, same pattern as a non-admin's
// userId override on the booking routes. The routes stay public for ordinary
// browsing, so knowing an appointment id alone mustn't reveal whether it
// holds slots.
export async function allowedExcludeAppointmentId(request: NextRequest): Promise<string | undefined> {
    const requested = request.nextUrl.searchParams.get("excludeAppointmentId")
    if (!requested) return undefined

    const session = await auth()
    if (session?.user?.role === "ADMIN") return requested
    if (!session?.user?.id) return undefined

    const owned = await prisma.appointment.findFirst({
        where: { id: requested, userId: session.user.id },
        select: { id: true },
    })
    return owned?.id
}
