// Gift cards — server-only (imports prisma). A card is sold at the desk (paid
// for at the POS), printed as a code, and later redeemed onto an account,
// where its value becomes store credit. See PLAN_GIFT_CARDS_AND_VOUCHERS.md.

import { prisma } from "@/lib/prisma"
import { addCredit } from "@/lib/credit"
import {
    formatGiftCardCode,
    generateGiftCardCode,
    hashGiftCardCode,
    normalizeGiftCardCode,
} from "@/lib/gift-card-code"

// One message for "no such code", "already redeemed" and "voided" — the
// same reasoning as reset-password: an error that tells them apart would
// confirm which codes exist to anyone guessing.
export const INVALID_GIFT_CARD_MESSAGE = "That gift card code isn't valid. Check it and try again, or ask the salon."

export class InvalidGiftCardError extends Error {
    constructor() {
        super(INVALID_GIFT_CARD_MESSAGE)
        this.name = "InvalidGiftCardError"
    }
}

// Creates the card and returns its code — the only time the plaintext
// exists. The caller shows it once, for printing; only the hash is stored.
export async function issueGiftCard(args: {
    valueCents: number
    purchaserName: string | null
    recipientName: string | null
    issuedById: string
}) {
    const code = generateGiftCardCode()
    const card = await prisma.giftCard.create({
        data: {
            ...args,
            codeHash: await hashGiftCardCode(code),
            codeLast4: code.slice(-4),
        },
    })
    // A hash collision on 80 random bits isn't a realistic case; if it ever
    // happened, the unique index would throw P2002 and the desk retries.
    return { card, code: formatGiftCardCode(code) }
}

// Moves a card's whole value onto userId's account, once. actorId is who did
// it: the customer themselves, or the admin at the desk. Throws
// InvalidGiftCardError for any code that can't be redeemed.
export async function redeemGiftCard({ code, userId, actorId }: { code: unknown; userId: string; actorId: string }) {
    const normalized = normalizeGiftCardCode(code)
    if (!normalized) throw new InvalidGiftCardError()
    const codeHash = await hashGiftCardCode(normalized)

    return prisma.$transaction(async (tx) => {
        const card = await tx.giftCard.findUnique({ where: { codeHash } })
        if (!card || card.status !== "ISSUED") throw new InvalidGiftCardError()

        // The claim: conditional on still being ISSUED, so two people
        // redeeming the same code at once can't both win — the second
        // update waits on the row lock, re-checks, and matches nothing.
        const claimed = await tx.giftCard.updateMany({
            where: { id: card.id, status: "ISSUED" },
            data: { status: "REDEEMED", redeemedByUserId: userId, redeemedAt: new Date() },
        })
        if (claimed.count === 0) throw new InvalidGiftCardError()

        await addCredit(tx, {
            userId,
            amountCents: card.valueCents,
            kind: "GIFT_CARD",
            giftCardId: card.id,
            createdById: actorId,
        })

        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { creditBalanceCents: true } })
        return { addedCents: card.valueCents, balanceCents: user.creditBalanceCents }
    })
}
