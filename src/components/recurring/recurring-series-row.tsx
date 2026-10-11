import type { Artist, RecurringAppointment, RecurringStatus, Service, User } from "@/generated/prisma/client"
// Type-only: erased at compile time, so this doesn't pull booking.ts's
// Prisma imports into the client bundle.
import type { MaterializeResult } from "@/lib/booking"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { parseLocalDate } from "@/lib/format"
import { isCustomerNotifiableSkip } from "@/lib/recurring"
import { timeStringToDate } from "@/lib/schedule-grid"

// Deliberately a Pick, not the full `User` — this crosses a Server→Client
// boundary in the admin salon-wide page. Keep in sync with
// SAFE_USER_SELECT_BASIC in src/lib/user-select.ts.
export type RecurringSeriesUser = Pick<User, "id" | "name" | "email">

export type RecurringAppointmentWithRelations = RecurringAppointment & {
    artist: Artist
    service: Service
    user?: RecurringSeriesUser
    // Upcoming weeks that couldn't be booked (see upcomingSkipsInclude() in
    // src/lib/booking.ts). Optional so a row merged from an older response
    // shape still renders.
    skippedOccurrences?: { occurrenceDate: string; reason: string }[]
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

function formatShortDate(date: Date): string {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function seriesLabel(series: Pick<RecurringAppointment, "dayOfWeek" | "startTime" | "intervalWeeks">): string {
    const day = DAY_NAMES[series.dayOfWeek]
    const time = formatTime(series.startTime)
    // intervalWeeks === 1 reads awkwardly as "every 1 week," so special-case it.
    return series.intervalWeeks === 1
        ? `Every ${day} at ${time}`
        : `Every ${series.intervalWeeks} weeks on ${day} at ${time}`
}

// One-line summary of what a resume did, shown by every series surface.
export function describeResume(materialization: MaterializeResult): string {
    const restored = materialization.created.length + materialization.reactivated.length
    const unavailable = materialization.skipped.filter((s) => isCustomerNotifiableSkip(s.reason)).length
    const restoredText = `Resumed — ${restored} upcoming appointment${restored === 1 ? "" : "s"} booked.`
    return unavailable > 0
        ? `${restoredText} ${unavailable} week${unavailable === 1 ? "" : "s"} couldn't be restored because the time is no longer available.`
        : restoredText
}

export type SeriesConfirmation = "cancel" | "change" | null

export function RecurringSeriesRow({
    series,
    showCustomer,
    busy,
    confirming,
    onPause,
    onResume,
    onCancel,
    onChangeTime,
    onConfirm,
    onConfirmBack,
}: {
    series: RecurringAppointmentWithRelations
    // true only on the dedicated salon-wide admin page — a customer never
    // needs to see their own name on their own row, and the per-customer
    // admin view already knows whose page it's on.
    showCustomer: boolean
    busy: boolean
    // Which destructive action is awaiting confirmation on this row, if any.
    confirming: SeriesConfirmation
    onPause: () => void
    onResume: () => void
    onCancel: () => void
    // There's deliberately no "edit series" feature: changing a series'
    // time is cancel + book a new one (see PLAN_RECURRING_MATERIALIZATION.md).
    // Omit to hide the action (e.g. a customer when online booking is closed,
    // who would otherwise cancel with no way to rebook).
    onChangeTime?: () => void
    onConfirm: () => void
    onConfirmBack: () => void
}) {
    const skipped = series.skippedOccurrences ?? []

    return (
        <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
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
                {/* Also what makes a stalled scheduler visible: if the daily
                    job stops running, this date stops moving forward. */}
                {series.status === "ACTIVE" && series.materializedThrough && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        Booked through {formatShortDate(new Date(series.materializedThrough))}
                    </p>
                )}
                {series.status !== "CANCELLED" && skipped.length > 0 && (
                    <div className="mt-2 text-xs text-danger">
                        <p className="font-medium">Not booked:</p>
                        <ul className="mt-0.5">
                            {skipped.map((s) => {
                                const date = parseLocalDate(s.occurrenceDate)
                                return (
                                    <li key={s.occurrenceDate}>
                                        {date ? formatShortDate(date) : s.occurrenceDate} — {s.reason}
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                )}
            </div>

            {confirming ? (
                <div className="flex flex-col gap-2 sm:items-end">
                    <p className="text-sm text-danger sm:max-w-64 sm:text-right">
                        {confirming === "cancel"
                            ? "Cancel this series and free its upcoming appointments?"
                            : "To change the time, this standing appointment is cancelled and you book a new one. Continue?"}
                    </p>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="md" onClick={onConfirmBack} disabled={busy}>
                            Back
                        </Button>
                        <Button variant="danger" size="md" onClick={onConfirm} disabled={busy}>
                            {confirming === "cancel" ? "Confirm Cancel" : "Cancel & Rebook"}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex shrink-0 flex-wrap gap-2">
                    {series.status === "ACTIVE" && (
                        <Button variant="secondary" size="md" onClick={onPause} disabled={busy}>
                            Pause
                        </Button>
                    )}
                    {series.status === "PAUSED" && (
                        <Button variant="secondary" size="md" onClick={onResume} disabled={busy}>
                            Resume
                        </Button>
                    )}
                    {series.status !== "CANCELLED" && onChangeTime && (
                        <Button variant="secondary" size="md" onClick={onChangeTime} disabled={busy}>
                            Change Time
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
