'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/format"
import { formatGiftCardCode, GIFT_CARD_CODE_LENGTH, normalizeGiftCardCode } from "@/lib/gift-card-code"

// What's typed or pasted → "K7QM-4XRT-9W": uppercase, anything but letters
// and digits dropped, capped at a full code, dashes added between groups of
// four. A dash only appears once a character follows it, so backspacing
// past a group never gets stuck on a trailing dash.
function formatTypedCode(input: string): string {
    const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, GIFT_CARD_CODE_LENGTH)
    return formatGiftCardCode(raw)
}

// Typing in a printed gift card's code. Used by a customer on My Account
// (endpoint /api/gift-cards/redeem) and by staff for a customer at the desk
// (/api/admin/gift-cards/redeem, with that customer's userId).
export function RedeemGiftCardForm({
    endpoint,
    extraBody = {},
    onRedeemed,
}: {
    endpoint: string
    extraBody?: Record<string, string>
    // Called with the amount added, once the server confirms.
    onRedeemed: (addedCents: number) => void
}) {
    const [code, setCode] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    // Only checks the shape (16 characters from the code alphabet) — whether
    // the card exists is the server's call.
    const looksValid = normalizeGiftCardCode(code) !== null

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!looksValid) return
        setError(null)
        setSuccess(null)
        setBusy(true)

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, ...extraBody }),
            })

            const body = await res.json().catch(() => null)
            if (!res.ok) {
                setError(body?.error ?? "Couldn't redeem that gift card. Please try again.")
                return
            }

            setCode("")
            setSuccess(`${formatPrice(body.data.addedCents)} added. New balance: ${formatPrice(body.data.balanceCents)}.`)
            onRedeemed(body.data.addedCents)
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <label htmlFor="gift-card-code" className="block text-xs font-medium text-muted-foreground">
                Gift card code
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
                <input
                    id="gift-card-code"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    // No maxLength: formatTypedCode caps the length, and a
                    // browser cap would cut off a pasted code with extra
                    // spaces before it could be cleaned up.
                    value={code}
                    onChange={(e) => {
                        setCode(formatTypedCode(e.target.value))
                        setSuccess(null)
                    }}
                    disabled={busy}
                    className="h-11 w-full rounded-sm border border-border bg-background px-3 font-mono text-sm uppercase tracking-wider text-foreground"
                />
                <Button type="submit" variant="secondary" size="md" disabled={busy || !looksValid} className="shrink-0">
                    {busy ? "Adding..." : "Add Gift Card"}
                </Button>
            </div>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            {success && (
                <p role="status" className="text-sm text-success">
                    {success}
                </p>
            )}
        </form>
    )
}
