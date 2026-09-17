import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDuration, formatPrice } from "@/lib/format"
import { STATUS_TONE, type AdminAppointment } from "./appointment-shared"

// A bottom-sheet variant of the fixed-inset-x-0-bottom-0 + safe-area-padding
// technique src/components/ui/sticky-action-bar.tsx uses, not a reuse of that
// component directly — StickyActionBar is styled specifically as a thin
// button row with no rounded corners or backdrop, while this needs to be a
// full content panel. A floating popover was ruled out: it has nowhere good
// to render next to a ~24px-tall schedule block near a 375px viewport edge.
export function ScheduleDetailSheet({
    appointment,
    busy,
    onConfirm,
    onComplete,
    onCancel,
    onClose,
}: {
    appointment: AdminAppointment | null
    busy: boolean
    onConfirm: () => void
    onComplete: () => void
    onCancel: () => void
    onClose: () => void
}) {
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
        <>
            <div className="fixed inset-0 z-30 cursor-pointer bg-foreground/40" onClick={onClose} aria-hidden />
            <div
                role="dialog"
                aria-modal="true"
                className={
                    "fixed inset-x-0 bottom-0 z-30 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t " +
                    "border-border bg-background px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
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
                </dl>

                {(appointment.status === "UPCOMING" || appointment.status === "CONFIRMED") && (
                    <div className="mt-4 flex gap-2">
                        {appointment.status === "UPCOMING" && (
                            <Button variant="secondary" size="md" onClick={onConfirm} disabled={busy} className="flex-1">
                                Confirm
                            </Button>
                        )}
                        {appointment.status === "CONFIRMED" && (
                            <Button variant="secondary" size="md" onClick={onComplete} disabled={busy} className="flex-1">
                                Mark Completed
                            </Button>
                        )}
                        <Button variant="danger" size="md" onClick={onCancel} disabled={busy} className="flex-1">
                            Cancel
                        </Button>
                    </div>
                )}
            </div>
        </>
    )
}
