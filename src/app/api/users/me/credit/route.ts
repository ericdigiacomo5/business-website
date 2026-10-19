import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/require-user"
import { CREDIT_ENTRY_SELECT } from "@/lib/credit-shared"

// The signed-in customer's store-credit balance and history, newest first.
export async function GET() {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const [user, entries] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { creditBalanceCents: true } }),
        prisma.creditEntry.findMany({
            where: { userId },
            select: CREDIT_ENTRY_SELECT,
            orderBy: { createdAt: "desc" },
        }),
    ])

    if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }

    return Response.json({ data: { balanceCents: user.creditBalanceCents, entries } })
}
