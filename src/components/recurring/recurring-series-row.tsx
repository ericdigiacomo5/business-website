import type { Artist, RecurringAppointment, RecurringStatus, Service, User } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { timeStringToDate } from "@/lib/schedule-grid"

// Deliberately a Pick, not the full `User` — this crosses a Server→Client
// boundary in the admin salon-wide page. Keep in sync with
// SAFE_USER_SELECT_BASIC in src/lib/user-select.ts.
export type RecurringSeriesUser = Pick<User, "id" | "name" | "email">

export type RecurringAppointmentWithRelations = RecurringAppointment & {
    artist: Artist
    service: Service
    user?: RecurringSeriesUser
}

export const RECURRING_STATUS_TONE: Record<RecurringStatus, "success" | "muted" | "danger"> = {
    ACTIVE: "success",
    PAUSED: "muted",
    CANCELLED: "danger",
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function formatTime(time: string): string {
    // Reuses the same HH:mm -> Date parser the availability engine already
    // uses (the date part is irrelevant here, only the time-of-day matters).
    return timeStringToDate(new Date(), time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    })
}

function seriesLabel(series: Pick<RecurringAppointment, "dayOfWeek" | "startTime" | "intervalWeeks">): string {
    const day = DAY_NAMES[series.dayOfWeek]
    const time = formatTime(series.startTime)
    // intervalWeeks === 1 reads awkwardly as "every 1 week," so special-case it.
    return series.intervalWeeks === 1
        ? `Every ${day} at ${time}`
        : `Every ${series.intervalWeeks} weeks on ${day} at ${time}`
}

export function RecurringSeriesRow({
    series,
    showCustomer,
    allowResume = true,
    busy,
    confirmingCancel,
    onPause,
    onResume,
    onCancel,
    onConfirmCancel,
    onCancelBack,
}: {
    series: RecurringAppointmentWithRelations
    // true only on the dedicated salon-wide admin page — a customer never
    // needs to see their own name on their own row, and the per-customer
    // admin view already knows whose page it's on.
    showCustomer: boolean
    // Resuming a PAUSED series doesn't re-materialize any occurrences until
    // a rolling re-materialization job exists (see
    // PLAN_RECURRING_MANAGEMENT.md) — an admin has that document for
    // context, a customer doesn't. Default true (admin surfaces); the
    // customer-facing caller passes false to hide the action entirely
    // rather than ship a button whose effect is currently invisible.
    allowResume?: boolean
    busy: boolean
    confirmingCancel: boolean
    onPause: () => void
    onResume: () => void
    onCancel: () => void
    onConfirmCancel: () => void
    onCancelBack: () => void
}) {
    return (
        <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-foreground">{series.service.name}</span>
                    <Badge tone={RECURRING_STATUS_TONE[series.status]}>{series.status}</Badge>
                </div>
                {showCustomer && series.user && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {series.user.name ?? series.user.email}
                    </p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">with {series.artist.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{seriesLabel(series)}</p>
            </div>

            {confirmingCancel ? (
                <div className="flex flex-col gap-2 sm:items-end">
                    <p className="text-sm text-danger">Cancel this series and free its upcoming appointments?</p>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="md" onClick={onCancelBack} disabled={busy}>
                            Back
                        </Button>
                        <Button variant="danger" size="md" onClick={onConfirmCancel} disabled={busy}>
                            Confirm Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex shrink-0 gap-2">
                    {series.status === "ACTIVE" && (
                        <Button variant="secondary" size="md" onClick={onPause} disabled={busy}>
                            Pause
                        </Button>
                    )}
                    {series.status === "PAUSED" && allowResume && (
                        <Button variant="secondary" size="md" onClick={onResume} disabled={busy}>
                            Resume
                        </Button>
                    )}
                    {series.status !== "CANCELLED" && (
                        <Button variant="danger" size="md" onClick={onCancel} disabled={busy}>
                            Cancel
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
