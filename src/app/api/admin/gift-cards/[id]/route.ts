import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"
import { readJsonObject } from "@/lib/request"
import { requiredText } from "@/lib/validation"
import { CREDIT_NOTE_MAX, GIFT_CARD_SELECT } from "@/lib/credit-shared"

// Voids a card that hasn't been redeemed — a lost card, or one issued by
// mistake. The only change a card allows: { status: "VOID", voidReason }.
// A lost card is replaced by voiding it and issuing a new one, since the
// code can't be shown again.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    if (body.status !== "VOID") {
        return Response.json({ error: 'status must be "VOID"' }, { status: 400 })
    }

    const voidReason = requiredText(body.voidReason, CREDIT_NOTE_MAX)
    if (voidReason === null) {
        return Response.json(
            { error: `A reason is required (up to ${CREDIT_NOTE_MAX} characters)` },
            { status: 400 }
        )
    }

    const card = await prisma.giftCard.findUnique({ where: { id }, select: { status: true } })
    if (!card) {
        return Response.json({ error: "Gift card not found" }, { status: 404 })
    }

    // Conditional on ISSUED, so a void racing a redemption can't undo
    // credit that's already on someone's account: whichever commits first
    // wins and the other matches nothing.
    const { count } = await prisma.giftCard.updateMany({
        where: { id, status: "ISSUED" },
        data: { status: "VOID", voidedAt: new Date(), voidReason },
    })
    if (count === 0) {
        return Response.json(
            { error: "Only a card that hasn't been redeemed can be voided" },
            { status: 409 }
        )
    }

    const updated = await prisma.giftCard.findUniqueOrThrow({ where: { id }, select: GIFT_CARD_SELECT })
    return Response.json({ data: updated })
}
