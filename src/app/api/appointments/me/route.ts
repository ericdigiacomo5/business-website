import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
    // TODO: read `userId` from request.nextUrl.searchParams.
    // Required — same trust-boundary trade-off as POST /api/appointments:
    // no auth yet, so identity comes straight from the query string. Replace
    // with a session-derived id once NextAuth lands.
    const userId = request.nextUrl.searchParams.get("userId")

    // TODO: validate userId is present (missing -> 400).
    if (!userId) {
        return Response.json(
            { error: "User ID required" },
            { status: 400 }
        )
    }

    // TODO: prisma.appointment.findMany({ where: { userId }, orderBy: { startTime: 'asc' } })
    // Returns full history (past, cancelled, completed included) — no status
    // filtering for now; can add a `status` query param later if the
    // frontend actually needs it.
    const appointments = await prisma.appointment.findMany({
        where: { userId: userId },
        orderBy: { startTime: 'asc' }
    })

    return Response.json(appointments)
}
