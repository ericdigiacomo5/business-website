import { useState } from "react"
import { X } from "lucide-react"
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
    describeDiscount,
    discountCents,
    discountError,
    discountOf,
    totalCents,
    type Discount,
} from "@/lib/discount"
import { PAYMENT_METHOD_LABEL, STATUS_LABEL, STATUS_TONE, type AdminAppointment } from "./appointment-shared"

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "OTHER"]

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

// Centered modal, not a bottom sheet — a floating popover anchored to the
// schedule block was ruled out (nowhere good to render next to a ~24px-tall
// block near a 375px viewport edge), and an edge-to-edge bottom sheet was
// tried first but replaced with this centered card per feedback. The overlay
// itself handles the close-on-backdrop-click; the inner card stops
// propagation so clicking the card contents doesn't also close it.
export function ScheduleDetailSheet({
    appointment,
    busy,
    error,
    onConfirm,
    onCheckout,
    onCancel,
    onNoShow,
    onReschedule,
    onDiscount,
    onChangeLength,
    services,
    onChangeServices,
    onClose,
}: {
    appointment: AdminAppointment | null
    busy: boolean
    // Why the last action on this appointment failed (e.g. no room to make
    // it longer). Shown here because the page behind is under the overlay.
    error: string | null
    onConfirm: () => void
    onCheckout: (paymentMethod: PaymentMethod) => void
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
    onClose: () => void
}) {
    const [checkingOut, setCheckingOut] = useState(false)
    const [rescheduling, setRescheduling] = useState(false)
    const [discounting, setDiscounting] = useState(false)
    const [changingLength, setChangingLength] = useState(false)
    const [editingServices, setEditingServices] = useState(false)

    if (!appointment) return null

    const lengthMinutes = durationMinutesOf(appointment)
    // "Usual" = what its services add up to at the lengths they were booked.
    const usualMinutes = servicesDurationMinutes(appointment.services)

    const priceCents = servicesPriceCents(appointment.services)
    const discount = discountOf(appointment)
    const isOpen = appointment.status === "PENDING" || appointment.status === "CONFIRMED"

    const start = new Date(appointment.startTime)
    const end = new Date(appointment.endTime)
    const timeRange = `${start.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`

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
                        <dd className="font-medium text-foreground">
                            {appointment.user.name ?? appointment.user.email}
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
                    {appointment.status === "COMPLETED" && appointment.paymentMethod && (
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Paid</dt>
                            <dd className="font-medium text-foreground">
                                {PAYMENT_METHOD_LABEL[appointment.paymentMethod]}
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
                            className="min-h-11 cursor-pointer text-sm font-medium text-primary disabled:cursor-not-allowed"
                        >
                            Edit services
                        </button>
                        <button
                            type="button"
                            onClick={() => setChangingLength(true)}
                            disabled={busy}
                            className="min-h-11 cursor-pointer text-sm font-medium text-primary disabled:cursor-not-allowed"
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
                            <div className="flex flex-col gap-2">
                                {/* A discount is part of checking out: it's
                                    offered here, once the visit is being rung
                                    up, not on the appointment beforehand. */}
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">
                                        Total due: {formatPrice(totalCents(priceCents, discount))}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setDiscounting(true)}
                                        disabled={busy}
                                        className="min-h-11 cursor-pointer text-sm font-medium text-primary disabled:cursor-not-allowed"
                                    >
                                        {discount ? "Change discount" : "Add discount"}
                                    </button>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    How was this paid? (via the POS terminal)
                                </p>
                                <div className="flex gap-2">
                                    {PAYMENT_METHODS.map((method) => (
                                        <Button
                                            key={method}
                                            variant="secondary"
                                            size="md"
                                            onClick={() => onCheckout(method)}
                                            disabled={busy}
                                            className="flex-1"
                                        >
                                            {PAYMENT_METHOD_LABEL[method]}
                                        </Button>
                                    ))}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="md"
                                    onClick={() => setCheckingOut(false)}
                                    disabled={busy}
                                >
                                    Back
                                </Button>
                            </div>
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
                                    <Button variant="danger" size="md" onClick={onNoShow} disabled={busy} className="flex-1">
                                        No-Show
                                    </Button>
                                )}
                                <Button variant="danger" size="md" onClick={onCancel} disabled={busy} className="flex-1">
                                    Cancel
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
