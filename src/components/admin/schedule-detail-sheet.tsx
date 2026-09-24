import { useState } from "react"
import { X } from "lucide-react"
import type { PaymentMethod } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDuration, formatPrice } from "@/lib/format"
import { DateTimeStep } from "@/components/booking/steps/datetime-step"
import { PAYMENT_METHOD_LABEL, STATUS_TONE, type AdminAppointment } from "./appointment-shared"

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "OTHER"]

// Centered modal, not a bottom sheet — a floating popover anchored to the
// schedule block was ruled out (nowhere good to render next to a ~24px-tall
// block near a 375px viewport edge), and an edge-to-edge bottom sheet was
// tried first but replaced with this centered card per feedback. The overlay
// itself handles the close-on-backdrop-click; the inner card stops
// propagation so clicking the card contents doesn't also close it.
export function ScheduleDetailSheet({
    appointment,
    busy,
    onConfirm,
    onCheckout,
    onCancel,
    onReschedule,
    onClose,
}: {
    appointment: AdminAppointment | null
    busy: boolean
    onConfirm: () => void
    onCheckout: (paymentMethod: PaymentMethod) => void
    onCancel: () => void
    onReschedule: (startTime: string) => void
    onClose: () => void
}) {
    const [checkingOut, setCheckingOut] = useState(false)
    const [rescheduling, setRescheduling] = useState(false)

    if (!appointment) return null

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
                    "max-h-[85vh] w-full max-w-sm cursor-auto overflow-y-auto rounded-2xl border " +
                    "border-border bg-background px-4 pt-4 pb-6 shadow-lg"
                }
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{appointment.service.name}</span>
                        <Badge tone={STATUS_TONE[appointment.status]}>{appointment.status}</Badge>
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
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">Duration &amp; Price</dt>
                        <dd className="font-medium text-foreground">
                            {formatDuration(appointment.service.durationMinutes)} &middot;{" "}
                            {formatPrice(appointment.service.priceCents)}
                        </dd>
                    </div>
                    {appointment.status === "COMPLETED" && appointment.paymentMethod && (
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Paid</dt>
                            <dd className="font-medium text-foreground">
                                {PAYMENT_METHOD_LABEL[appointment.paymentMethod]}
                            </dd>
                        </div>
                    )}
                </dl>

                {(appointment.status === "UPCOMING" || appointment.status === "CONFIRMED") && (
                    <div className="mt-4">
                        {checkingOut ? (
                            <div className="flex flex-col gap-2">
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
                                        serviceDurationMinutes={appointment.service.durationMinutes}
                                        excludeAppointmentId={appointment.id}
                                        heading="Move to a New Time"
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
                                {appointment.status === "UPCOMING" && (
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
