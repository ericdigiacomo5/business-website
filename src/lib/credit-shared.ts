// Client-safe (type-only Prisma import) — the shapes and labels for store
// credit and gift cards that cross from the server to the browser, plus the
// selects that produce them, so a query and the component reading it can't
// drift apart (same idea as SAFE_USER_SELECT).

import type { CreditEntryKind, GiftCardStatus } from "@/generated/prisma/client"
import { formatSalonDate } from "@/lib/salon-time"

export const CREDIT_KIND_LABEL: Record<CreditEntryKind, string> = {
    GIFT_CARD: "Gift card",
    SPENT: "Used at checkout",
    REVERSED: "Returned from checkout",
    ADJUSTMENT: "Adjustment",
}

export const GIFT_CARD_STATUS_LABEL: Record<GiftCardStatus, string> = {
    ISSUED: "Not redeemed",
    REDEEMED: "Redeemed",
    VOID: "Void",
}

// A ledger row as the customer sees it. No createdBy: which staff member
// made a change isn't the customer's business.
export const CREDIT_ENTRY_SELECT = {
    id: true,
    amountCents: true,
    kind: true,
    note: true,
    createdAt: true,
    appointment: { select: { id: true, startTime: true } },
    giftCard: { select: { codeLast4: true } },
} as const

// The admin view adds who made each change.
export const ADMIN_CREDIT_ENTRY_SELECT = {
    ...CREDIT_ENTRY_SELECT,
    createdBy: { select: { name: true, email: true } },
} as const

export type CreditEntryRow = {
    id: string
    amountCents: number
    kind: CreditEntryKind
    note: string | null
    // Date on the server, ISO string once it has crossed to the client as
    // JSON — components wrap it in new Date() either way.
    createdAt: Date | string
    appointment: { id: string; startTime: Date | string } | null
    giftCard: { codeLast4: string } | null
    createdBy?: { name: string | null; email: string }
}

// Never codeHash: it isn't secret the way a code is, but nothing in the UI
// needs it, so it stays on the server.
export const GIFT_CARD_SELECT = {
    id: true,
    codeLast4: true,
    valueCents: true,
    status: true,
    purchaserName: true,
    recipientName: true,
    issuedAt: true,
    redeemedAt: true,
    voidedAt: true,
    voidReason: true,
    issuedBy: { select: { name: true, email: true } },
    redeemedBy: { select: { id: true, name: true, email: true } },
    voidedBy: { select: { name: true, email: true } },
} as const

export type GiftCardRow = {
    id: string
    codeLast4: string
    valueCents: number
    status: GiftCardStatus
    purchaserName: string | null
    recipientName: string | null
    issuedAt: Date | string
    redeemedAt: Date | string | null
    voidedAt: Date | string | null
    voidReason: string | null
    issuedBy: { name: string | null; email: string }
    redeemedBy: { id: string; name: string | null; email: string } | null
    // Null for cards voided before this was recorded (2026-10-19).
    voidedBy: { name: string | null; email: string } | null
}

// Longest note an admin can attach to an adjustment, a return or a void.
export const CREDIT_NOTE_MAX = 300

// Gift card values, in cents. The upper bound is a typo guard more than a
// policy (an extra zero typed at the desk); it also caps a single credit
// adjustment.
export const MIN_GIFT_CARD_CENTS = 100
export const MAX_GIFT_CARD_CENTS = 100_000

// "Gift card ending 2PNB" / "Used at checkout (visit on Oct 3, 2026)" /
// "Adjustment". The note, if any, is shown separately.
export function describeCreditEntry(entry: CreditEntryRow): string {
    const label = CREDIT_KIND_LABEL[entry.kind]
    if (entry.kind === "GIFT_CARD" && entry.giftCard) return `${label} ending ${entry.giftCard.codeLast4}`
    if (entry.appointment) {
        const when = formatSalonDate(entry.appointment.startTime, {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
        return `${label} (visit on ${when})`
    }
    return label
}
