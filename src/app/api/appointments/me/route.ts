import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/require-user"

export async function GET(request: NextRequest) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const appointments = await prisma.appointment.findMany({
        where: { userId: userId },
        orderBy: { startTime: 'asc' }
    })

    return Response.json(appointments)
}
