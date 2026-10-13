import type { Artist, RecurringAppointment, RecurringStatus, User } from "@/generated/prisma/client"
import { servicesLabel } from "@/lib/appointment-services"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { parseLocalDate } from "@/lib/format"
import { timeStringToDate } from "@/lib/schedule-grid"

// Deliberately a Pick, not the full `User` — this crosses a Server→Client
// boundary in the admin salon-wide page. Keep in sync with
// SAFE_USER_SELECT_BASIC in src/lib/user-select.ts.
export type RecurringSeriesUser = Pick<User, "id" | "name" | "email">

export type RecurringAppointmentWithRelations = RecurringAppointment & {
    artist: Artist
    // One or more — every visit of the series is booked with all of them.
    services: { service: { id: string; name: string } }[]
    user?: RecurringSeriesUser
    // Upcoming weeks that couldn't be booked (see upcomingSkipsInclude() in
    // src/lib/booking.ts). Optional so a row merged from an older response
    // shape still renders.
    skippedOccurrences?: { occurrenceDate: string; reason: string }[]
}

export const RECURRING_STATUS_TONE: Record<RecurringStatus, "success" | "danger"> = {
    ACTIVE: "success",
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

// With the year: a series can run up to a year, so "Oct 12" alone is ambiguous.
function formatEndDate(date: Date): string {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function seriesLabel(series: Pick<RecurringAppointment, "dayOfWeek" | "startTime" | "intervalWeeks">): string {
    const day = DAY_NAMES[series.dayOfWeek]
    const time = formatTime(series.startTime)
    // intervalWeeks === 1 reads awkwardly as "every 1 week," so special-case it.
    return series.intervalWeeks === 1
        ? `Every ${day} at ${time}`
        : `Every ${series.intervalWeeks} weeks on ${day} at ${time}`
}

// A standing appointment can only be cancelled as a whole — no pause, no
// editing. Its individual appointments are rescheduled or cancelled from the
// normal appointment views, like any other booking.
export function RecurringSeriesRow({
    series,
    showCustomer,
    busy,
    confirming,
    onCancel,
    onConfirm,
    onConfirmBack,
}: {
    series: RecurringAppointmentWithRelations
    // true only on the dedicated salon-wide admin page — a customer never
    // needs to see their own name on their own row, and the per-customer
    // admin view already knows whose page it's on.
    showCustomer: boolean
    busy: boolean
    // Whether Cancel is awaiting confirmation on this row.
    confirming: boolean
    onCancel: () => void
    onConfirm: () => void
    onConfirmBack: () => void
}) {
    const skipped = series.skippedOccurrences ?? []

    return (
        <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-foreground">{servicesLabel(series.services)}</span>
                    <Badge tone={RECURRING_STATUS_TONE[series.status]}>{series.status}</Badge>
                </div>
                {showCustomer && series.user && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {series.user.name ?? series.user.email}
                    </p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">with {series.artist.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{seriesLabel(series)}</p>
                {series.status !== "CANCELLED" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        Ends {formatEndDate(new Date(series.seriesEnd))}
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
                        Cancel this series and free its upcoming appointments?
                    </p>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="md" onClick={onConfirmBack} disabled={busy}>
                            Back
                        </Button>
                        <Button variant="danger" size="md" onClick={onConfirm} disabled={busy}>
                            Confirm Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                series.status === "ACTIVE" && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                        <Button variant="danger" size="md" onClick={onCancel} disabled={busy}>
                            Cancel
                        </Button>
                    </div>
                )
            )}
        </div>
    )
}
