'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/format"
import { CREDIT_NOTE_MAX, type CreditEntryRow } from "@/lib/credit-shared"
import { CreditHistory } from "@/components/credit/credit-history"
import { RedeemGiftCardForm } from "@/components/credit/redeem-gift-card-form"

// A manual correction, e.g. a gift card redeemed onto the wrong account:
// remove it here, add it on the right one. Reason required — it's kept on
// the ledger.
function AdjustCreditForm({
    userId,
    balanceCents,
    onSaved,
    onCancel,
}: {
    userId: string
    balanceCents: number
    onSaved: (data: { balanceCents: number; entries: CreditEntryRow[] }) => void
    onCancel: () => void
}) {
    const [direction, setDirection] = useState<"add" | "remove">("add")
    const [amount, setAmount] = useState("")
    const [note, setNote] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const cents = Math.round(Number(amount) * 100)
    const problem =
        amount.trim() === "" || Number.isNaN(cents) || cents < 1
            ? null
            : direction === "remove" && cents > balanceCents
              ? `Can't remove more than the balance (${formatPrice(balanceCents)})`
              : null
    const ready = amount.trim() !== "" && cents >= 1 && problem === null && note.trim() !== ""

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!ready) return
        setError(null)
        setBusy(true)

        try {
            const res = await fetch(`/api/admin/users/${userId}/credit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amountCents: direction === "add" ? cents : -cents, note: note.trim() }),
            })

            const body = await res.json().catch(() => null)
            if (!res.ok) {
                setError(body?.error ?? "Couldn't adjust the credit. Please try again.")
                return
            }

            onSaved(body.data)
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-sm border border-border p-3">
            <div className="flex gap-2">
                {(["add", "remove"] as const).map((option) => (
                    <Button
                        key={option}
                        type="button"
                        variant={direction === option ? "inverse" : "secondary"}
                        size="md"
                        aria-pressed={direction === option}
                        onClick={() => setDirection(option)}
                        disabled={busy}
                        className="flex-1"
                    >
                        {option === "add" ? "Add" : "Remove"}
                    </Button>
                ))}
            </div>
            <div>
                <label htmlFor="adjust-amount" className="block text-xs font-medium text-muted-foreground">
                    Amount ($)
                </label>
                <input
                    id="adjust-amount"
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    step={0.01}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                    className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                />
                {problem && (
                    <p role="alert" className="mt-1 text-xs text-danger">
                        {problem}
                    </p>
                )}
            </div>
            <div>
                <label htmlFor="adjust-note" className="block text-xs font-medium text-muted-foreground">
                    Reason
                </label>
                <input
                    id="adjust-note"
                    type="text"
                    maxLength={CREDIT_NOTE_MAX}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={busy}
                    className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            <div className="flex gap-2">
                <Button type="submit" variant="secondary" size="md" disabled={busy || !ready} className="flex-1">
                    {busy ? "Saving..." : "Save Adjustment"}
                </Button>
                <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={busy} className="flex-1">
                    Cancel
                </Button>
            </div>
        </form>
    )
}

export function AdminCreditPanel({
    userId,
    initialBalanceCents,
    initialEntries,
}: {
    userId: string
    initialBalanceCents: number
    initialEntries: CreditEntryRow[]
}) {
    const [balanceCents, setBalanceCents] = useState(initialBalanceCents)
    const [entries, setEntries] = useState(initialEntries)
    const [adjusting, setAdjusting] = useState(false)

    // After a redemption, re-read the ledger rather than guess the new row.
    async function reload() {
        try {
            const res = await fetch(`/api/admin/users/${userId}/credit`)
            if (!res.ok) return
            const body = await res.json()
            setBalanceCents(body.data.balanceCents)
            setEntries(body.data.entries)
        } catch {
            // The success message already showed; a reload restores the list.
        }
    }

    return (
        <div className="mt-3 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface shadow-sm p-4">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance</p>
                    <p className="mt-0.5 text-2xl font-semibold text-surface-foreground">{formatPrice(balanceCents)}</p>
                </div>
                {!adjusting && (
                    <Button variant="secondary" size="md" onClick={() => setAdjusting(true)}>
                        Adjust
                    </Button>
                )}
            </div>

            {adjusting && (
                <AdjustCreditForm
                    userId={userId}
                    balanceCents={balanceCents}
                    onSaved={(data) => {
                        setBalanceCents(data.balanceCents)
                        setEntries(data.entries)
                        setAdjusting(false)
                    }}
                    onCancel={() => setAdjusting(false)}
                />
            )}

            <RedeemGiftCardForm endpoint="/api/admin/gift-cards/redeem" extraBody={{ userId }} onRedeemed={reload} />

            <CreditHistory entries={entries} />
        </div>
    )
}
