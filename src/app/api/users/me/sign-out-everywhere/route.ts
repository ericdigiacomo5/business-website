import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/require-user"
import { rejectCrossOrigin } from "@/lib/request"

// "Sign out of all devices." No body. Stamps sessionsRevokedAt, which the
// jwt callback in src/auth.ts compares against each session's issue time —
// every session that exists right now, this one included, is signed out on
// its next request. (JWT sessions can't be deleted server-side; this is the
// substitute, same mechanism as a password reset.)
export async function POST(request: Request) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const crossOrigin = rejectCrossOrigin(request)
    if (crossOrigin) return crossOrigin

    await prisma.user.update({
        where: { id: userId },
        data: { sessionsRevokedAt: new Date() },
    })

    return Response.json({ data: { signedOut: true } })
}
