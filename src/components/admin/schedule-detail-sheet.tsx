import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { isNoShowFlagged, noShowLabel } from "@/lib/customer-summary"
import type { DiscountType, PaymentMethod, Service } from "@/generated/prisma/client"
import {
    MAX_SERVICES_PER_APPOINTMENT,
    servicesDurationMinutes,
    servicesLabel,
    servicesPriceCents,
    type ServiceLine,
} from "@/lib/appointment-services"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDuration, formatPrice } from "@/lib/format"
import { DateTimeStep } from "@/components/booking/steps/datetime-step"
import { ADMIN_DAYS_AHEAD } from "@/lib/recurring"
import { appointmentLengthOptions, durationMinutesOf } from "@/lib/schedule-grid"
import {
    amountDueCents,
    describeDiscount,
    discountCents,
    discountError,
    discountOf,
    totalCents,
    type Discount,
} from "@/lib/discount"
import { CREDIT_NOTE_MAX } from "@/lib/credit-shared"
import { PAYMENT_METHOD_LABEL, STATUS_LABEL, STATUS_TONE, type AdminAppointment } from "./appointment-shared"
import { formatSalonDateTime, formatSalonTime } from "@/lib/salon-time"

// GROUPON: the customer showed a Groupon voucher. Staff redeem it in
// Groupon's Merchant Center; this only records that it paid for the visit.
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "GROUPON", "OTHER"]

// What checking out records. paymentMethod is null when nothing was left
// for the POS; creditCents is the store credit spent now (0 = none).
export type Checkout = { paymentMethod: PaymentMethod | null; creditCents: number }

// The checkout step: total, optional discount, optional store credit, and
// how the rest was paid. The customer's balance is fetched fresh when this
// opens rather than carried on the schedule's data, which could be hours
// old; the server re-checks it at the moment of the debit anyway.
function CheckoutForm({
    userId,
    owedCents,
    discount,
    busy,
    onCheckout,
    onDiscount,
    onBack,
}: {
    userId: string
    // After discount and any credit already applied.
    owedCents: number
    discount: Discount | null
    busy: boolean
    onCheckout: (checkout: Checkout) => void
    onDiscount: () => void
    onBack: () => void
}) {
    // null while loading; a failed load just hides the credit option.
    const [balanceCents, setBalanceCents] = useState<number | null>(null)
    const [usingCredit, setUsingCredit] = useState(false)
    const [creditInput, setCreditInput] = useState("")

    useEffect(() => {
        let cancelled = false
        fetch(`/api/admin/users/${userId}/credit`)
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => {
                if (!cancelled) setBalanceCents(body?.data?.balanceCents ?? 0)
            })
            .catch(() => {
                if (!cancelled) setBalanceCents(0)
            })
        return () => {
            cancelled = true
        }
    }, [userId])

    const maxCreditCents = Math.min(balanceCents ?? 0, owedCents)
    const typed = Number(creditInput)
    const creditCents = usingCredit ? Math.round(typed * 100) : 0
    const creditProblem = !usingCredit
        ? null
        : creditInput.trim() === "" || Number.isNaN(typed) || creditCents < 1
          ? "Enter an amount"
          : creditCents > maxCreditCents
            ? `At most ${formatPrice(maxCreditCents)}`
            : null
    const dueCents = owedCents - (creditProblem ? 0 : creditCents)

    return (
        <div className="flex flex-col gap-2">
            {/* A discount is part of checking out: it's offered here, once
                the visit is being rung up, not on the appointment beforehand. */}
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Total due: {formatPrice(owedCents)}</p>
                <button
                    type="button"
                    onClick={onDiscount}
                    disabled={busy}
                    className="min-h-11 cursor-pointer text-sm font-medium text-primary-strong disabled:cursor-not-allowed"
                >
                    {discount ? "Change discount" : "Add discount"}
                </button>
            </div>

            {balanceCents !== null && balanceCents > 0 && owedCents > 0 && (
                <div className="rounded-sm border border-border p-3">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                        <input
                            type="checkbox"
                            checked={usingCredit}
                            disabled={busy}
                            onChange={(e) => {
                                setUsingCredit(e.target.checked)
                                // Defaults to as much as can be used.
                                setCreditInput((maxCreditCents / 100).toFixed(2))
                            }}
                            className="h-5 w-5 rounded border-border"
                        />
                        <span className="font-medium text-foreground">
                            Use store credit (balance {formatPrice(balanceCents)})
                        </span>
                    </label>
                    {usingCredit && (
                        <div>
                            <label htmlFor="credit-amount" className="block text-xs font-medium text-muted-foreground">
                                Credit to use ($)
                            </label>
                            <input
                                id="credit-amount"
                                type="number"
                                inputMode="decimal"
                                min={0.01}
                                max={maxCreditCents / 100}
                                step={0.01}
                                value={creditInput}
                                onChange={(e) => setCreditInput(e.target.value)}
                                disabled={busy}
                                className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                            />
                            {creditProblem && (
                                <p role="alert" className="mt-1 text-xs text-danger">
                                    {creditProblem}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {usingCredit && !creditProblem && (
                <p className="text-sm font-medium text-foreground">Left to pay: {formatPrice(dueCents)}</p>
            )}

            {dueCents > 0 ? (
                <>
                    <p className="text-sm text-muted-foreground">
                        {usingCredit ? "How was the rest paid?" : "How was this paid?"} (POS terminal, or a Groupon
                        voucher redeemed in Merchant Center)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {PAYMENT_METHODS.map((method) => (
                            <Button
                                key={method}
                                variant="secondary"
                                size="md"
                                onClick={() => onCheckout({ paymentMethod: method, creditCents: creditProblem ? 0 : creditCents })}
                                disabled={busy || creditProblem !== null || balanceCents === null}
                            >
                                {PAYMENT_METHOD_LABEL[method]}
                            </Button>
                        ))}
                    </div>
                </>
            ) : (
                <Button
                    variant="secondary"
                    size="md"
                    onClick={() => onCheckout({ paymentMethod: null, creditCents: creditProblem ? 0 : creditCents })}
                    disabled={busy || creditProblem !== null}
                >
                    Complete &mdash; Nothing Due
                </Button>
            )}

            <Button variant="ghost" size="md" onClick={onBack} disabled={busy}>
                Back
            </Button>
        </div>
    )
}

// Gives back store credit spent at checkout (it was entered by mistake).
// A reason is required; it's kept on the customer's credit history.
function ReturnCreditForm({
    creditCents,
    busy,
    onReturn,
    onBack,
}: {
    creditCents: number
    busy: boolean
    onReturn: (note: string) => void
    onBack: () => void
}) {
    const [note, setNote] = useState("")
    const ready = note.trim().length > 0

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
                e.preventDefault()
                if (ready) onReturn(note.trim())
            }}
        >
            <p className="text-sm text-muted-foreground">
                {`Puts ${formatPrice(creditCents)} back on the customer's store credit. If the visit was paid some other way instead, check it out again with that payment method afterwards.`}
            </p>
            <div>
                <label htmlFor="return-credit-note" className="block text-xs font-medium text-muted-foreground">
                    Reason
                </label>
                <input
                    id="return-credit-note"
                    type="text"
                    maxLength={CREDIT_NOTE_MAX}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={busy}
                    className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>
            <Button type="submit" variant="danger" size="md" disabled={busy || !ready}>
                Return Credit
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={onBack} disabled={busy}>
                Back
            </Button>
        </form>
    )
}

const DISCOUNT_TYPES: { type: DiscountType; label: string }[] = [
    { type: "PERCENT", label: "% off" },
    { type: "AMOUNT", label: "$ off" },
]

// Percent-or-dollars discount entry. Dollars are typed as dollars and sent
// as cents, the same convention the service form uses for prices.
function DiscountForm({
    priceCents,
    current,
    busy,
    onApply,
    onRemove,
    onBack,
}: {
    priceCents: number
    current: Discount | null
    busy: boolean
    onApply: (discount: Discount) => void
    onRemove: () => void
    onBack: () => void
}) {
    const [type, setType] = useState<DiscountType>(current?.type ?? "PERCENT")
    const [input, setInput] = useState(
        current ? (current.type === "PERCENT" ? String(current.value) : (current.value / 100).toFixed(2)) : ""
    )

    const number = Number(input)
    const value = type === "PERCENT" ? number : Math.round(number * 100)
    const problem =
        input.trim() === "" ? null : Number.isNaN(number) ? "Enter a number" : discountError({ type, value }, priceCents)
    const ready = input.trim() !== "" && problem === null

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
                e.preventDefault()
                if (ready) onApply({ type, value })
            }}
        >
            <div className="flex gap-2">
                {DISCOUNT_TYPES.map((option) => (
                    <Button
                        key={option.type}
                        type="button"
                        variant={type === option.type ? "inverse" : "secondary"}
                        size="md"
                        aria-pressed={type === option.type}
                        onClick={() => {
                            // 10 (%) and 10 ($) aren't the same discount —
                            // don't carry the number across.
                            if (type !== option.type) setInput("")
                            setType(option.type)
                        }}
                        disabled={busy}
                        className="flex-1"
                    >
                        {option.label}
                    </Button>
                ))}
            </div>

            <div>
                <label htmlFor="discount-value" className="block text-xs font-medium text-muted-foreground">
                    {type === "PERCENT" ? "Percent off" : "Dollars off"}
                </label>
                <input
                    id="discount-value"
                    type="number"
                    inputMode="decimal"
                    min={type === "PERCENT" ? 1 : 0.01}
                    max={type === "PERCENT" ? 100 : priceCents / 100}
                    step={type === "PERCENT" ? 1 : 0.01}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={busy}
                    className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                />
                {problem ? (
                    <p role="alert" className="mt-1 text-xs text-danger">
                        {problem}
                    </p>
                ) : (
                    ready && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            New total: {formatPrice(totalCents(priceCents, { type, value }))}
                        </p>
                    )
                )}
            </div>

            <div className="flex gap-2">
                <Button type="submit" variant="secondary" size="md" disabled={busy || !ready} className="flex-1">
                    Apply
                </Button>
                {current && (
                    <Button type="button" variant="danger" size="md" onClick={onRemove} disabled={busy} className="flex-1">
                        Remove
                    </Button>
                )}
            </div>
            <Button type="button" variant="ghost" size="md" onClick={onBack} disabled={busy}>
                Back
            </Button>
        </form>
    )
}

// Adds or removes services on an appointment that's already booked — e.g. a
// client decides at the chair to add a pedicure. Saves the whole list; the
// appointment's length resets to what the new services add up to.
function ServicesForm({
    services,
    current,
    busy,
    onSave,
    onBack,
}: {
    services: Service[]
    current: ServiceLine[]
    busy: boolean
    onSave: (serviceIds: string[]) => void
    onBack: () => void
}) {
    const [selectedIds, setSelectedIds] = useState(current.map((line) => line.serviceId))

    // Everything bookable, plus anything already on the appointment that has
    // since been retired — it has to stay listed or it couldn't be kept.
    const retired = current
        .filter((line) => !services.some((service) => service.id === line.serviceId))
        .map((line) => ({
            id: line.serviceId,
            name: line.service.name,
            priceCents: line.priceCents,
            durationMinutes: line.durationMinutes,
        }))
    const options = [
        ...services.map((service) => {
            // A service already on the appointment shows what it was booked
            // at, since that's what it stays at.
            const booked = current.find((line) => line.serviceId === service.id)
            return {
                id: service.id,
                name: service.name,
                priceCents: booked?.priceCents ?? service.priceCents,
                durationMinutes: booked?.durationMinutes ?? service.durationMinutes,
            }
        }),
        ...retired,
    ]

    const chosen = selectedIds
        .map((id) => options.find((option) => option.id === id))
        .filter((option) => option !== undefined)
    const unchanged =
        selectedIds.length === current.length && selectedIds.every((id, index) => current[index].serviceId === id)
    const atLimit = selectedIds.length >= MAX_SERVICES_PER_APPOINTMENT

    function toggle(id: string) {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((other) => other !== id) : [...prev, id]))
    }

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
                e.preventDefault()
                if (selectedIds.length > 0) onSave(selectedIds)
            }}
        >
            <fieldset className="flex flex-col gap-1" disabled={busy}>
                <legend className="text-xs font-medium text-muted-foreground">Services on this appointment</legend>
                {options.map((option) => {
                    const checked = selectedIds.includes(option.id)
                    return (
                        <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                            <input
                                type="checkbox"
                                checked={checked}
                                disabled={!checked && atLimit}
                                onChange={() => toggle(option.id)}
                                className="h-5 w-5 rounded border-border"
                            />
                            <span className="flex-1 font-medium text-foreground">{option.name}</span>
                            <span className="text-muted-foreground">
                                {formatDuration(option.durationMinutes)} &middot; {formatPrice(option.priceCents)}
                            </span>
                        </label>
                    )
                })}
            </fieldset>

            {selectedIds.length === 0 ? (
                <p role="alert" className="text-xs text-danger">
                    An appointment needs at least one service.
                </p>
            ) : (
                <p className="text-xs text-muted-foreground">
                    New length: {formatDuration(servicesDurationMinutes(chosen))} &middot; New price:{" "}
                    {formatPrice(servicesPriceCents(chosen))}. Starts at the same time; any extra time has to be open
                    on the schedule.
                </p>
            )}

            <Button type="submit" variant="secondary" size="md" disabled={busy || unchanged || selectedIds.length === 0}>
                Save services
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={onBack} disabled={busy}>
                Back
            </Button>
        </form>
    )
}

// Sets this one appointment's length, for a client who takes longer (or
// less time) than its services usually do.
function LengthForm({
    current,
    usual,
    busy,
    onSave,
    onBack,
}: {
    current: number
    usual: number
    busy: boolean
    onSave: (minutes: number) => void
    onBack: () => void
}) {
    const [minutes, setMinutes] = useState(current)

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
                e.preventDefault()
                onSave(minutes)
            }}
        >
            <div>
                <label htmlFor="appointment-length" className="block text-xs font-medium text-muted-foreground">
                    Appointment length
                </label>
                <select
                    id="appointment-length"
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    disabled={busy}
                    className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                >
                    {appointmentLengthOptions(current).map((option) => (
                        <option key={option} value={option}>
                            {formatDuration(option)}
                            {option === usual ? " (usual)" : ""}
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                    Starts at the same time; only the end moves. The extra time has to be open on the schedule.
                </p>
            </div>
            <Button type="submit" variant="secondary" size="md" disabled={busy || minutes === current}>
                Save length
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={onBack} disabled={busy}>
                Back
            </Button>
        </form>
    )
}

// What a rebooking will book: the same client, artist and services, at a
// time picked here.
export type Rebooking = {
    startTime: string
    serviceIds: string[]
    // Only set when this appointment had a custom length, so the next visit
    // keeps it; otherwise the services' usual length applies.
    durationMinutes: number | null
}

// Books the client's next visit straight from a completed appointment — the
// usual moment is at checkout, while they're still at the desk. Pick a time,
// confirm, done; anything different (another artist, other services) goes
// through a normal booking from the grid instead.
function RebookForm({
    appointment,
    activeServices,
    lengthMinutes,
    usualMinutes,
    busy,
    onBook,
    onBack,
}: {
    appointment: AdminAppointment
    // Active services only — the booking route doesn't check whether a
    // service is retired, so one that has been is left off here.
    activeServices: Service[]
    lengthMinutes: number
    usualMinutes: number
    busy: boolean
    onBook: (rebooking: Rebooking) => void
    onBack: () => void
}) {
    const [startTime, setStartTime] = useState<string | null>(null)
    // Kept when going back from the confirm step (e.g. after the time was
    // taken), so the picker reopens on the same day instead of today.
    const [date, setDate] = useState<string | null>(null)

    const lines = appointment.services.filter((line) =>
        activeServices.some((service) => service.id === line.serviceId)
    )
    const dropped = appointment.services.filter((line) => !lines.includes(line))

    if (lines.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                    The services on this appointment are no longer offered, so it can&apos;t be booked again as-is. Book
                    the next visit from the schedule instead.
                </p>
                <Button variant="ghost" size="md" onClick={onBack}>
                    Back
                </Button>
            </div>
        )
    }

    // A custom length only carries over when every service does — with one
    // dropped, the old length no longer describes the visit.
    const durationMinutes = dropped.length === 0 && lengthMinutes !== usualMinutes ? lengthMinutes : null
    const visitMinutes =
        durationMinutes ??
        lines.reduce(
            (sum, line) => sum + (activeServices.find((s) => s.id === line.serviceId)?.durationMinutes ?? 0),
            0
        )

    if (startTime) {
        const when = formatSalonDateTime(startTime, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        })
        return (
            <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-foreground">Book the next visit?</p>
                <dl className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">When</dt>
                        <dd className="font-medium text-foreground">{when}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Services</dt>
                        <dd className="text-right font-medium text-foreground">
                            {servicesLabel(lines)} ({formatDuration(visitMinutes)})
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">With</dt>
                        <dd className="font-medium text-foreground">{appointment.artist.name}</dd>
                    </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                    Booked at today&apos;s prices. The client gets a confirmation email.
                </p>
                <Button
                    size="md"
                    onClick={() =>
                        onBook({ startTime, serviceIds: lines.map((line) => line.serviceId), durationMinutes })
                    }
                    disabled={busy}
                >
                    Book Next Visit
                </Button>
                <Button variant="ghost" size="md" onClick={() => setStartTime(null)} disabled={busy}>
                    Choose another time
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {dropped.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    {/* One string, not text around {…}: split across lines,
                        the compiler dropped the space after "is". */}
                    {`${servicesLabel(dropped)} ${dropped.length === 1 ? "is" : "are"} no longer offered and won't be rebooked.`}
                </p>
            )}
            <DateTimeStep
                artistId={appointment.artistId}
                initialDate={date}
                serviceDurationMinutes={visitMinutes}
                heading="Book the Next Visit"
                daysAhead={ADMIN_DAYS_AHEAD}
                onSelect={(pickedDate, picked) => {
                    setDate(pickedDate)
                    setStartTime(picked)
                }}
            />
            <Button variant="ghost" size="md" onClick={onBack}>
                Back
            </Button>
        </div>
    )
}

// Centered modal, not a bottom sheet — a floating popover anchored to the
// schedule block was ruled out (nowhere good to render next to a ~24px-tall
// block near a 375px viewport edge), and an edge-to-edge bottom sheet was
// tried first but replaced with this centered card per feedback. The overlay
// itself handles the close-on-backdrop-click; the inner card stops
// propagation so clicking the card contents doesn't also close it.
export function ScheduleDetailSheet({
    appointment,
    customerNoShows,
    busy,
    error,
    onConfirm,
    onCheckout,
    onReturnCredit,
    onCancel,
    onNoShow,
    onReschedule,
    onDiscount,
    onChangeLength,
    services,
    onChangeServices,
    onRebook,
    onClose,
}: {
    appointment: AdminAppointment | null
    // The customer's lifetime no-shows — flagged from NO_SHOW_FLAG_THRESHOLD
    // up, so the front desk can call ahead (FEATURE_GAPS.md Gap 28).
    customerNoShows: number
    busy: boolean
    // Why the last action on this appointment failed (e.g. no room to make
    // it longer). Shown here because the page behind is under the overlay.
    error: string | null
    onConfirm: () => void
    onCheckout: (checkout: Checkout) => void
    // Gives back the store credit a completed appointment used.
    onReturnCredit: (note: string) => void
    onCancel: () => void
    onNoShow: () => void
    onReschedule: (startTime: string) => void
    // null removes the discount.
    onDiscount: (discount: Discount | null) => void
    onChangeLength: (durationMinutes: number) => void
    // Active services, for adding to this appointment.
    services: Service[]
    // The appointment's full new list, in order.
    onChangeServices: (serviceIds: string[]) => void
    // Books a new appointment for this client; offered once it's completed.
    onRebook: (rebooking: Rebooking) => void
    onClose: () => void
}) {
    const [checkingOut, setCheckingOut] = useState(false)
    const [rescheduling, setRescheduling] = useState(false)
    const [discounting, setDiscounting] = useState(false)
    const [changingLength, setChangingLength] = useState(false)
    const [editingServices, setEditingServices] = useState(false)
    const [rebooking, setRebooking] = useState(false)
    const [returningCredit, setReturningCredit] = useState(false)
    // Cancel / No-Show waiting for their confirm step.
    const [ending, setEnding] = useState<"cancel" | "noShow" | null>(null)

    if (!appointment) return null

    const lengthMinutes = durationMinutesOf(appointment)
    // "Usual" = what its services add up to at the lengths they were booked.
    const usualMinutes = servicesDurationMinutes(appointment.services)

    const priceCents = servicesPriceCents(appointment.services)
    const discount = discountOf(appointment)
    const creditCents = appointment.creditAppliedCents
    const dueCents = amountDueCents(priceCents, discount, creditCents)
    const isOpen = appointment.status === "PENDING" || appointment.status === "CONFIRMED"

    const start = new Date(appointment.startTime)
    const end = new Date(appointment.endTime)
    const timeRange = `${formatSalonDateTime(start, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })} – ${formatSalonTime(end)}`

    return (
        <div
            className="fixed inset-0 z-30 flex cursor-pointer items-center justify-center bg-foreground/40 p-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                className={
                    "max-h-[92vh] w-full max-w-md cursor-auto overflow-y-auto rounded-2xl border " +
                    "border-border bg-background px-4 pt-4 pb-6 shadow-lg"
                }
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{servicesLabel(appointment.services)}</span>
                        <Badge tone={STATUS_TONE[appointment.status]}>{STATUS_LABEL[appointment.status]}</Badge>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <dl className="mt-3 flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">Artist</dt>
                        <dd className="font-medium text-foreground">{appointment.artist.name}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">Client</dt>
                        <dd className="flex flex-wrap items-center justify-end gap-2 font-medium text-foreground">
                            <Link href={`/admin/users/${appointment.userId}`}>
                                {appointment.user.name ?? appointment.user.email}
                            </Link>
                            {isNoShowFlagged(customerNoShows) && (
                                <Badge tone="danger">{noShowLabel(customerNoShows)}</Badge>
                            )}
                        </dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">When</dt>
                        <dd className="font-medium text-foreground">{timeRange}</dd>
                    </div>
                    {appointment.services.length > 1 && (
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Services</dt>
                            <dd className="text-right font-medium text-foreground">
                                {appointment.services.map((line) => (
                                    <span key={line.serviceId} className="block">
                                        {line.service.name}{" "}
                                        <span className="font-normal text-muted-foreground">
                                            &middot; {formatPrice(line.priceCents)}
                                        </span>
                                    </span>
                                ))}
                            </dd>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">Duration &amp; Price</dt>
                        <dd className="font-medium text-foreground">
                            {formatDuration(lengthMinutes)}
                            {lengthMinutes !== usualMinutes && ` (usually ${formatDuration(usualMinutes)})`} &middot;{" "}
                            {formatPrice(priceCents)}
                        </dd>
                    </div>
                    {discount && (
                        <>
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">Discount</dt>
                                <dd className="font-medium text-foreground">
                                    {describeDiscount(discount)} (&minus;{formatPrice(discountCents(priceCents, discount))})
                                </dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">Total</dt>
                                <dd className="font-medium text-foreground">
                                    {formatPrice(totalCents(priceCents, discount))}
                                </dd>
                            </div>
                        </>
                    )}
                    {creditCents > 0 && (
                        <>
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">Store credit</dt>
                                <dd className="font-medium text-foreground">&minus;{formatPrice(creditCents)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">Paid in salon</dt>
                                <dd className="font-medium text-foreground">{formatPrice(dueCents)}</dd>
                            </div>
                        </>
                    )}
                    {appointment.status === "COMPLETED" && (
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Paid</dt>
                            <dd className="font-medium text-foreground">
                                {appointment.paymentMethod
                                    ? PAYMENT_METHOD_LABEL[appointment.paymentMethod]
                                    : creditCents > 0
                                      ? "Store credit"
                                      : "Nothing due"}
                            </dd>
                        </div>
                    )}
                </dl>

                {error && (
                    <p role="alert" className="mt-3 text-sm text-danger">
                        {error}
                    </p>
                )}

                {isOpen && !checkingOut && !rescheduling && !discounting && !changingLength && !editingServices && (
                    <div className="mt-1 flex gap-6">
                        <button
                            type="button"
                            onClick={() => setEditingServices(true)}
                            disabled={busy}
                            className="min-h-11 cursor-pointer text-sm font-medium text-primary-strong disabled:cursor-not-allowed"
                        >
                            Edit services
                        </button>
                        <button
                            type="button"
                            onClick={() => setChangingLength(true)}
                            disabled={busy}
                            className="min-h-11 cursor-pointer text-sm font-medium text-primary-strong disabled:cursor-not-allowed"
                        >
                            Change length
                        </button>
                    </div>
                )}

                {isOpen && (
                    <div className="mt-4">
                        {editingServices ? (
                            <ServicesForm
                                services={services}
                                current={appointment.services}
                                busy={busy}
                                // Same as the length form: steps aside right
                                // away; the rows above (or the error) update
                                // when the server answers.
                                onSave={(serviceIds) => {
                                    onChangeServices(serviceIds)
                                    setEditingServices(false)
                                }}
                                onBack={() => setEditingServices(false)}
                            />
                        ) : changingLength ? (
                            <LengthForm
                                current={lengthMinutes}
                                usual={usualMinutes}
                                busy={busy}
                                // Steps aside right away; the rows above (or
                                // the error) update when the server answers.
                                onSave={(minutes) => {
                                    onChangeLength(minutes)
                                    setChangingLength(false)
                                }}
                                onBack={() => setChangingLength(false)}
                            />
                        ) : discounting ? (
                            <DiscountForm
                                priceCents={priceCents}
                                current={discount}
                                busy={busy}
                                // Only reachable from the checkout step, and
                                // returns to it (checkingOut stays true). The
                                // rows above and "Total due" update when the
                                // server's row comes back.
                                onApply={(next) => {
                                    onDiscount(next)
                                    setDiscounting(false)
                                }}
                                onRemove={() => {
                                    onDiscount(null)
                                    setDiscounting(false)
                                }}
                                onBack={() => setDiscounting(false)}
                            />
                        ) : checkingOut ? (
                            <CheckoutForm
                                userId={appointment.userId}
                                owedCents={dueCents}
                                discount={discount}
                                busy={busy}
                                onCheckout={onCheckout}
                                onDiscount={() => setDiscounting(true)}
                                onBack={() => setCheckingOut(false)}
                            />
                        ) : rescheduling ? (
                            <div className="flex flex-col gap-2">
                                <div className={busy ? "pointer-events-none opacity-50" : undefined}>
                                    <DateTimeStep
                                        artistId={appointment.artistId}
                                        initialDate={null}
                                        // Its own length, so a reschedule keeps a
                                        // length that was set for this client.
                                        serviceDurationMinutes={lengthMinutes}
                                        excludeAppointmentId={appointment.id}
                                        heading="Move to a New Time"
                                        daysAhead={ADMIN_DAYS_AHEAD}
                                        onSelect={(_date, startTime) => onReschedule(startTime)}
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="md"
                                    onClick={() => setRescheduling(false)}
                                    disabled={busy}
                                >
                                    Back
                                </Button>
                            </div>
                        ) : ending ? (
                            // Cancelling emails the customer and both free the
                            // slot, so they ask first; the red is this step.
                            <div role="group" aria-label="Confirm" className="flex flex-col gap-2 rounded-lg bg-danger/5 p-3">
                                <p className="text-sm font-medium text-foreground">
                                    {ending === "cancel"
                                        ? "Cancel this appointment? The customer is emailed and the time opens up."
                                        : "Mark as a no-show? The time opens up; no email is sent."}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="danger"
                                        size="md"
                                        disabled={busy}
                                        className="flex-1"
                                        onClick={() => {
                                            setEnding(null)
                                            if (ending === "cancel") onCancel()
                                            else onNoShow()
                                        }}
                                    >
                                        {ending === "cancel" ? "Yes, Cancel" : "Yes, No-Show"}
                                    </Button>
                                    <Button variant="secondary" size="md" disabled={busy} className="flex-1" onClick={() => setEnding(null)}>
                                        Keep
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                {appointment.status === "PENDING" && (
                                    <Button variant="secondary" size="md" onClick={onConfirm} disabled={busy} className="flex-1">
                                        Confirm
                                    </Button>
                                )}
                                {appointment.status === "CONFIRMED" && (
                                    <Button
                                        variant="secondary"
                                        size="md"
                                        onClick={() => setCheckingOut(true)}
                                        disabled={busy}
                                        className="flex-1"
                                    >
                                        Check Out
                                    </Button>
                                )}
                                <Button
                                    variant="secondary"
                                    size="md"
                                    onClick={() => setRescheduling(true)}
                                    disabled={busy}
                                    className="flex-1"
                                >
                                    Reschedule
                                </Button>
                                {appointment.status === "CONFIRMED" && (
                                    <Button variant="quiet" size="md" onClick={() => setEnding("noShow")} disabled={busy} className="flex-1">
                                        No-Show
                                    </Button>
                                )}
                                <Button variant="quiet" size="md" onClick={() => setEnding("cancel")} disabled={busy} className="flex-1">
                                    Cancel
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Checking out leaves this sheet open on the now-completed
                    appointment, so this is what the admin sees right after
                    picking the payment method. */}
                {appointment.status === "COMPLETED" && (
                    <div className="mt-4">
                        {returningCredit ? (
                            <ReturnCreditForm
                                creditCents={creditCents}
                                busy={busy}
                                // Steps aside right away; the rows above (or
                                // the error) update when the server answers.
                                onReturn={(note) => {
                                    onReturnCredit(note)
                                    setReturningCredit(false)
                                }}
                                onBack={() => setReturningCredit(false)}
                            />
                        ) : rebooking ? (
                            <RebookForm
                                appointment={appointment}
                                activeServices={services}
                                lengthMinutes={lengthMinutes}
                                usualMinutes={usualMinutes}
                                busy={busy}
                                onBook={onRebook}
                                onBack={() => setRebooking(false)}
                            />
                        ) : (
                            <>
                                <Button size="md" onClick={() => setRebooking(true)} disabled={busy} className="w-full">
                                    Book Next Visit
                                </Button>
                                {creditCents > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setReturningCredit(true)}
                                        disabled={busy}
                                        className="mt-1 min-h-11 cursor-pointer text-sm font-medium text-primary-strong disabled:cursor-not-allowed"
                                    >
                                        Return store credit
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
