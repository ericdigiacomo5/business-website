// Store credit — server-only (imports prisma). The ONLY code that changes
// User.creditBalanceCents. Every change is one CreditEntry row plus the
// matching balance update, inside the caller's transaction, so a balance
// change without its ledger row (or the reverse) can't happen.
//
// Credit is money the salon owes, so overspending is prevented by the
// database, not by careful call sites: a debit is a conditional update that
// only matches while the balance covers it (same "let the database arbitrate"
// pattern as AppointmentSlot's unique constraint and the reminder job's
// claim), and a CHECK constraint (balance >= 0) backs it up.

import type { CreditEntryKind, Prisma } from "@/generated/prisma/client"

type Tx = Prisma.TransactionClient

type EntryArgs = {
    userId: string
    // Always positive here; the sign comes from which function is called.
    amountCents: number
    kind: CreditEntryKind
    createdById: string
    giftCardId?: string
    appointmentId?: string
    note?: string | null
}

// Thrown by spendCredit() when the balance doesn't cover the amount — e.g.
// two checkouts for the same customer at once. Throwing rolls back the
// caller's whole transaction.
export class InsufficientCreditError extends Error {
    constructor() {
        super("Insufficient store credit")
        this.name = "InsufficientCreditError"
    }
}

function assertPositiveCents(amountCents: number) {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw new Error(`Credit amount must be a positive whole number of cents, got ${amountCents}`)
    }
}

// Adds credit (a redeemed gift card, a reversal, an upward adjustment).
// Throws P2025 if the user doesn't exist.
export async function addCredit(tx: Tx, { amountCents, ...entry }: EntryArgs) {
    assertPositiveCents(amountCents)
    await tx.user.update({
        where: { id: entry.userId },
        data: { creditBalanceCents: { increment: amountCents } },
    })
    return tx.creditEntry.create({ data: { ...entry, amountCents } })
}

// Takes credit away (spent at checkout, a downward adjustment). Only
// succeeds if the balance covers it at the moment of the write: under
// concurrent debits the row lock serializes them, and the loser re-checks
// the condition against the winner's new balance and matches zero rows.
export async function spendCredit(tx: Tx, { amountCents, ...entry }: EntryArgs) {
    assertPositiveCents(amountCents)
    const { count } = await tx.user.updateMany({
        where: { id: entry.userId, creditBalanceCents: { gte: amountCents } },
        data: { creditBalanceCents: { decrement: amountCents } },
    })
    if (count === 0) throw new InsufficientCreditError()
    return tx.creditEntry.create({ data: { ...entry, amountCents: -amountCents } })
}

// Reconciliation (cached balance = SUM(ledger) for every user) lives in
// scripts/check-credit-ledger.ts — `npm run check-credit`.
