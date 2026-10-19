import { prisma } from "@/lib/prisma"
import { requireAdmin, requireAdminId } from "@/lib/require-admin"
import { readJsonObject } from "@/lib/request"
import { requiredText } from "@/lib/validation"
import { addCredit, InsufficientCreditError, spendCredit } from "@/lib/credit"
import { ADMIN_CREDIT_ENTRY_SELECT, CREDIT_NOTE_MAX, MAX_GIFT_CARD_CENTS } from "@/lib/credit-shared"

async function loadCredit(userId: string) {
    const [user, entries] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { creditBalanceCents: true } }),
        prisma.creditEntry.findMany({
            where: { userId },
            select: ADMIN_CREDIT_ENTRY_SELECT,
            orderBy: { createdAt: "desc" },
        }),
    ])
    return user ? { balanceCents: user.creditBalanceCents, entries } : null
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params
    const credit = await loadCredit(id)
    if (!credit) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }

    return Response.json({ data: credit })
}

// A manual correction: { amountCents, note }. amountCents is signed —
// positive adds credit, negative removes it (never below zero). The ledger
// is append-only, so this is how any mistake is fixed, e.g. a card redeemed
// onto the wrong account: take it off one, add it to the other.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const adminId = await requireAdminId()
    if (adminId instanceof Response) return adminId

    const { id } = await params

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const { amountCents } = body
    if (
        typeof amountCents !== "number" ||
        !Number.isInteger(amountCents) ||
        amountCents === 0 ||
        Math.abs(amountCents) > MAX_GIFT_CARD_CENTS
    ) {
        return Response.json(
            { error: "amountCents must be a non-zero whole number of cents" },
            { status: 400 }
        )
    }

    const note = requiredText(body.note, CREDIT_NOTE_MAX)
    if (note === null) {
        return Response.json(
            { error: `A reason is required (up to ${CREDIT_NOTE_MAX} characters)` },
            { status: 400 }
        )
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }

    try {
        await prisma.$transaction(async (tx) => {
            const entry = { userId: id, kind: "ADJUSTMENT" as const, note, createdById: adminId }
            if (amountCents > 0) {
                await addCredit(tx, { ...entry, amountCents })
            } else {
                await spendCredit(tx, { ...entry, amountCents: -amountCents })
            }
        })
    } catch (error) {
        if (error instanceof InsufficientCreditError) {
            return Response.json(
                { error: "That would take the balance below $0.00" },
                { status: 409 }
            )
        }
        throw error
    }

    return Response.json({ data: await loadCredit(id) }, { status: 201 })
}
