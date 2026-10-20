import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireAdmin } from "@/lib/require-admin"
import { rejectCrossOrigin } from "@/lib/request"

// Staff signing a customer out of every device — e.g. they lost their phone
// or think someone else got into their account. No body. Same mechanism as
// the customer's own POST /api/users/me/sign-out-everywhere.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const crossOrigin = rejectCrossOrigin(request)
    if (crossOrigin) return crossOrigin

    const { id } = await params

    try {
        await prisma.user.update({
            where: { id },
            data: { sessionsRevokedAt: new Date() },
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return Response.json({ error: "User not found" }, { status: 404 })
        }
        throw error
    }

    return Response.json({ data: { signedOut: true } })
}
