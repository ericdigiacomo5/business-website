import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/require-user"
import { SERVICE_LINES_INCLUDE } from "@/lib/appointment-services"

export async function GET(request: NextRequest) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const appointments = await prisma.appointment.findMany({
        where: { userId: userId },
        include: { artist: true, ...SERVICE_LINES_INCLUDE },
        orderBy: { startTime: 'asc' }
    })

    return Response.json(appointments)
}
