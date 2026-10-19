'use client'

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/format"
import { SITE_NAME } from "@/lib/site"
import { TEXT_LIMITS } from "@/lib/validation"
import {
    CREDIT_NOTE_MAX,
    GIFT_CARD_STATUS_LABEL,
    MAX_GIFT_CARD_CENTS,
    MIN_GIFT_CARD_CENTS,
    type GiftCardRow,
} from "@/lib/credit-shared"

const STATUS_TONE: Record<GiftCardRow["status"], "success" | "muted" | "danger"> = {
    ISSUED: "success",
    REDEEMED: "muted",
    VOID: "danger",
}

const MIN_VALUE_DOLLARS = MIN_GIFT_CARD_CENTS / 100
const MAX_VALUE_DOLLARS = MAX_GIFT_CARD_CENTS / 100

function formatDate(value: Date | string): string {
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// The card as printed and handed to the buyer. Only this element prints
// (see the print rules in globals.css). The code exists only in this
// component's state: it's never stored, so once this is closed it can't be
// shown again — a lost card is voided and a new one issued.
function PrintableGiftCard({ card, code, onDone }: { card: GiftCardRow; code: string; onDone: () => void }) {
    const origin = typeof window === "undefined" ? "" : window.location.origin

    return (
        <div className="flex flex-col gap-3 rounded-sm border-2 border-primary p-4">
            <p className="text-sm font-medium text-foreground">
                Gift card issued. Print it now — the code can&apos;t be shown again after you close this.
            </p>

            <div className="gift-card-print w-full max-w-sm rounded-sm border border-foreground bg-surface p-6 text-surface-foreground">
                <p className="font-serif text-xl font-bold">{SITE_NAME}</p>
                <p className="font-script text-2xl text-accent">Gift Card</p>
                <p className="mt-3 text-3xl font-semibold">{formatPrice(card.valueCents)}</p>
                {card.recipientName && <p className="mt-2 text-sm">For: {card.recipientName}</p>}
                {card.purchaserName && <p className="text-sm">From: {card.purchaserName}</p>}
                <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Code</p>
                <p className="font-mono text-lg font-semibold tracking-wider">{code}</p>
                <p className="mt-4 text-xs text-muted-foreground">
                    {`To use it, sign in at ${origin}/account and add this code under Gift Cards & Store Credit, or bring this card to the salon. The value becomes store credit on your account and is applied at checkout. Never expires. Keep this code private — anyone who has it can redeem it.`}
                </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="md" onClick={() => window.print()} className="flex-1">
                    Print
                </Button>
                <Button variant="ghost" size="md" onClick={onDone} className="flex-1">
                    Done
                </Button>
            </div>
        </div>
    )
}

function IssueGiftCardForm({ onIssued }: { onIssued: (card: GiftCardRow, code: string) => void }) {
    const [value, setValue] = useState("")
    const [purchaserName, setPurchaserName] = useState("")
    const [recipientName, setRecipientName] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const dollars = Number(value)
    const valueCents = Math.round(dollars * 100)
    const ready =
        value.trim() !== "" && !Number.isNaN(dollars) && dollars >= MIN_VALUE_DOLLARS && dollars <= MAX_VALUE_DOLLARS

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!ready) return
        setError(null)
        setBusy(true)

        try {
            const res = await fetch("/api/admin/gift-cards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valueCents, purchaserName, recipientName }),
            })

            const body = await res.json().catch(() => null)
            if (!res.ok) {
                setError(body?.error ?? "Couldn't issue the gift card. Please try again.")
                return
            }

            setValue("")
            setPurchaserName("")
            setRecipientName("")
            onIssued(body.data.card, body.data.code)
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusy(false)
        }
    }

    const inputClass = "mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">
                Ring up the sale on the POS first, then record the card here to get its code.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
                <div>
                    <label htmlFor="gift-card-value" className="block text-xs font-medium text-muted-foreground">
                        Value ($)
                    </label>
                    <input
                        id="gift-card-value"
                        type="number"
                        inputMode="decimal"
                        min={MIN_VALUE_DOLLARS}
                        max={MAX_VALUE_DOLLARS}
                        step={0.01}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        disabled={busy}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="gift-card-purchaser" className="block text-xs font-medium text-muted-foreground">
                        Bought by (optional)
                    </label>
                    <input
                        id="gift-card-purchaser"
                        type="text"
                        maxLength={TEXT_LIMITS.personName}
                        value={purchaserName}
                        onChange={(e) => setPurchaserName(e.target.value)}
                        disabled={busy}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="gift-card-recipient" className="block text-xs font-medium text-muted-foreground">
                        For (optional)
                    </label>
                    <input
                        id="gift-card-recipient"
                        type="text"
                        maxLength={TEXT_LIMITS.personName}
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        disabled={busy}
                        className={inputClass}
                    />
                </div>
            </div>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            <Button type="submit" size="md" disabled={busy || !ready}>
                {busy ? "Issuing..." : "Issue Gift Card"}
            </Button>
        </form>
    )
}

function GiftCardListRow({ card, onUpdated }: { card: GiftCardRow; onUpdated: (card: GiftCardRow) => void }) {
    const [voiding, setVoiding] = useState(false)
    const [reason, setReason] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function handleVoid(e: React.FormEvent) {
        e.preventDefault()
        if (!reason.trim()) return
        setError(null)
        setBusy(true)

        try {
            const res = await fetch(`/api/admin/gift-cards/${card.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "VOID", voidReason: reason.trim() }),
            })

            const body = await res.json().catch(() => null)
            if (!res.ok) {
                setError(body?.error ?? "Couldn't void the card. Please try again.")
                return
            }

            onUpdated(body.data)
            setVoiding(false)
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusy(false)
        }
    }

    const names = [card.purchaserName && `from ${card.purchaserName}`, card.recipientName && `for ${card.recipientName}`]
        .filter(Boolean)
        .join(", ")

    return (
        <li className="flex flex-col gap-2 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{formatPrice(card.valueCents)}</span>
                    <span className="font-mono text-muted-foreground">····{card.codeLast4}</span>
                    <Badge tone={STATUS_TONE[card.status]}>{GIFT_CARD_STATUS_LABEL[card.status]}</Badge>
                </div>
                {card.status === "ISSUED" && !voiding && (
                    <button
                        type="button"
                        onClick={() => setVoiding(true)}
                        className="min-h-11 cursor-pointer text-sm font-medium text-danger"
                    >
                        Void
                    </button>
                )}
            </div>
            <p className="text-muted-foreground">
                {`Issued ${formatDate(card.issuedAt)} by ${card.issuedBy.name ?? card.issuedBy.email}${names ? ` · ${names}` : ""}`}
            </p>
            {card.status === "REDEEMED" && card.redeemedBy && card.redeemedAt && (
                <p className="text-muted-foreground">
                    {`Redeemed ${formatDate(card.redeemedAt)} by `}
                    <Link href={`/admin/users/${card.redeemedBy.id}`}>
                        {card.redeemedBy.name ?? card.redeemedBy.email}
                    </Link>
                </p>
            )}
            {card.status === "VOID" && card.voidedAt && (
                <p className="text-muted-foreground">{`Voided ${formatDate(card.voidedAt)}: ${card.voidReason ?? ""}`}</p>
            )}
            {voiding && (
                <form onSubmit={handleVoid} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <label htmlFor={`void-${card.id}`} className="block text-xs font-medium text-muted-foreground">
                            Reason (e.g. card lost, reissued)
                        </label>
                        <input
                            id={`void-${card.id}`}
                            type="text"
                            maxLength={CREDIT_NOTE_MAX}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={busy}
                            className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                        />
                    </div>
                    <Button type="submit" variant="danger" size="md" disabled={busy || !reason.trim()}>
                        Void Card
                    </Button>
                    <Button type="button" variant="ghost" size="md" onClick={() => setVoiding(false)} disabled={busy}>
                        Cancel
                    </Button>
                </form>
            )}
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
        </li>
    )
}

export function AdminGiftCardsManager({
    initialCards,
    customerCreditCents,
}: {
    initialCards: GiftCardRow[]
    // Sum of every customer's store-credit balance.
    customerCreditCents: number
}) {
    const [cards, setCards] = useState(initialCards)
    const [issued, setIssued] = useState<{ card: GiftCardRow; code: string } | null>(null)
    const [query, setQuery] = useState("")

    // What the salon owes: credit already on accounts plus cards sold but
    // not yet redeemed. The figure the accountant needs.
    const unredeemed = cards.filter((card) => card.status === "ISSUED")
    const unredeemedCents = unredeemed.reduce((sum, card) => sum + card.valueCents, 0)

    const q = query.trim().toLowerCase().replace(/^[·.\s]+/, "")
    const shown = q
        ? cards.filter((card) =>
              [card.codeLast4, card.purchaserName, card.recipientName, card.redeemedBy?.name, card.redeemedBy?.email]
                  .filter((field): field is string => !!field)
                  .some((field) => field.toLowerCase().includes(q))
          )
        : cards

    return (
        <div className="flex flex-col gap-6">
            <dl className="grid gap-3 sm:grid-cols-3">
                {[
                    ["Store credit on accounts", formatPrice(customerCreditCents)],
                    [`Unredeemed cards (${unredeemed.length})`, formatPrice(unredeemedCents)],
                    ["Total owed to customers", formatPrice(customerCreditCents + unredeemedCents)],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-sm border border-border bg-surface p-4">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                        <dd className="mt-1 text-xl font-semibold text-surface-foreground">{value}</dd>
                    </div>
                ))}
            </dl>

            <section>
                <h2 className="text-base font-semibold text-foreground">Sell a Gift Card</h2>
                <div className="mt-3">
                    {issued ? (
                        <PrintableGiftCard card={issued.card} code={issued.code} onDone={() => setIssued(null)} />
                    ) : (
                        <IssueGiftCardForm
                            onIssued={(card, code) => {
                                setCards((prev) => [card, ...prev])
                                setIssued({ card, code })
                            }}
                        />
                    )}
                </div>
            </section>

            <section>
                <h2 className="text-base font-semibold text-foreground">All Gift Cards</h2>
                <label htmlFor="gift-card-search" className="sr-only">
                    Search gift cards
                </label>
                <input
                    id="gift-card-search"
                    type="search"
                    placeholder="Search by last 4 of the code or a name"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="mt-3 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                />
                {shown.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                        {cards.length === 0 ? "No gift cards issued yet." : "No cards match that search."}
                    </p>
                ) : (
                    <ul className="mt-3 flex flex-col divide-y divide-border rounded-sm border border-border">
                        {shown.map((card) => (
                            <GiftCardListRow
                                key={card.id}
                                card={card}
                                onUpdated={(updated) =>
                                    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
                                }
                            />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}
