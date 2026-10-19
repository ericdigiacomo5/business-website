'use client'

import { useState } from "react"
import { formatPrice } from "@/lib/format"
import type { CreditEntryRow } from "@/lib/credit-shared"
import { CreditHistory } from "@/components/credit/credit-history"
import { RedeemGiftCardForm } from "@/components/credit/redeem-gift-card-form"

// My Account: the customer's store credit, where they add a printed gift
// card, and the history. Spending happens at checkout in the salon — staff
// apply it — so there's nothing else to do here.
export function MyStoreCredit({
    initialBalanceCents,
    initialEntries,
}: {
    initialBalanceCents: number
    initialEntries: CreditEntryRow[]
}) {
    const [balanceCents, setBalanceCents] = useState(initialBalanceCents)
    const [entries, setEntries] = useState(initialEntries)

    async function reload() {
        try {
            const res = await fetch("/api/users/me/credit")
            if (!res.ok) return
            const body = await res.json()
            setBalanceCents(body.data.balanceCents)
            setEntries(body.data.entries)
        } catch {
            // The success message already showed; a reload restores the list.
        }
    }

    return (
        <section className="mt-12">
            <h2 className="font-serif text-2xl font-bold text-foreground">Gift Cards &amp; Store Credit</h2>
            <div className="mt-4 rounded-sm border border-border bg-surface p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your balance</p>
                <p className="mt-0.5 text-2xl font-semibold text-surface-foreground">{formatPrice(balanceCents)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Applied at checkout when you visit. Store credit never expires.
                </p>
            </div>

            <div className="mt-4">
                <RedeemGiftCardForm endpoint="/api/gift-cards/redeem" onRedeemed={reload} />
            </div>

            <h3 className="mt-6 text-base font-semibold text-foreground">History</h3>
            <CreditHistory entries={entries} />
        </section>
    )
}
