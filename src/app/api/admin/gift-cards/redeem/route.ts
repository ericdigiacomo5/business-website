import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminId } from "@/lib/require-admin"
import { readJsonObject } from "@/lib/request"
import { InvalidGiftCardError, redeemGiftCard } from "@/lib/gift-cards"
import { sendCreditAdded } from "@/lib/appointment-emails"

// Staff redeeming a card for a customer at the desk — e.g. a walk-in who
// can't sign in. Body: { code, userId }.
export async function POST(request: Request) {
    const adminId = await requireAdminId()
    if (adminId instanceof Response) return adminId

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    if (typeof body.userId !== "string") {
        return Response.json({ error: "userId is required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } })
    if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }

    try {
        const result = await redeemGiftCard({ code: body.code, userId: user.id, actorId: adminId })
        after(() => sendCreditAdded(user.id, result.addedCents))
        return Response.json({ data: result })
    } catch (error) {
        if (error instanceof InvalidGiftCardError) {
            return Response.json({ error: error.message }, { status: 400 })
        }
        throw error
    }
}
