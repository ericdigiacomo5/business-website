import { ChevronLeft, ChevronRight } from "lucide-react"
import { toLocalDateKey } from "@/lib/format"
import { addDays } from "@/lib/recurring"
import { startOfWeek, type ScheduleView } from "@/lib/schedule-grid"
import { formatSalonDate, zonedParts } from "@/lib/salon-time"

// "Nov 22 – 28" or, across a month boundary, "Nov 29 – Dec 5".
function weekLabel(date: Date): string {
    const start = startOfWeek(date)
    const end = addDays(start, 6)
    const startText = formatSalonDate(start, { month: "short", day: "numeric" })
    const endText = formatSalonDate(
        end,
        zonedParts(start).month === zonedParts(end).month ? { day: "numeric" } : { month: "short", day: "numeric" }
    )
    return `${startText} – ${endText}`
}

// No 'use client' / interactivity needed here — the buttons are plain form
// submits (dateDown/dateUp), and the server does the date arithmetic and
// redirects to a canonical ?dateString= URL (see admin/page.tsx). The
// hidden status/artistId inputs exist so submitting this form doesn't wipe
// out whatever BookingFilters currently has selected — a GET form replaces
// the entire query string with only its own fields.
export function DatePicker({
    date,
    status,
    artistId,
    view,
}: {
    date: Date
    status: string
    artistId: string
    // In the week view the arrows move a week (the server reads the view
    // and steps 7 days) and the label shows the week's range.
    view: ScheduleView
}) {
    const unit = view === "week" ? "week" : "day"
    return (
        <form
            method="get"
            className="mt-4 flex items-center justify-center gap-4 rounded-lg border border-line bg-surface shadow-sm p-3"
        >
            <input type="hidden" name="dateString" value={toLocalDateKey(date)} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="artistId" value={artistId} />
            {view === "week" && <input type="hidden" name="view" value="week" />}

            <button
                type="submit"
                name="dateDown"
                value="-1"
                aria-label={`Previous ${unit}`}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <ChevronLeft className="h-5 w-5" />
            </button>

            <span className="min-w-36 text-center text-sm font-medium text-surface-foreground">
                {view === "week"
                    ? weekLabel(date)
                    : formatSalonDate(date, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                      })}
            </span>

            <button
                type="submit"
                name="dateUp"
                value="1"
                aria-label={`Next ${unit}`}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <ChevronRight className="h-5 w-5" />
            </button>
        </form>
    )
}