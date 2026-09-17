import { ChevronLeft, ChevronRight } from "lucide-react"
import { toLocalDateKey } from "@/lib/format"

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
}: {
    date: Date
    status: string
    artistId: string
}) {
    return (
        <form
            method="get"
            className="mt-4 flex items-center justify-center gap-4 rounded-sm border border-border bg-surface p-3"
        >
            <input type="hidden" name="dateString" value={toLocalDateKey(date)} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="artistId" value={artistId} />

            <button
                type="submit"
                name="dateDown"
                value="-1"
                aria-label="Previous day"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <ChevronLeft className="h-5 w-5" />
            </button>

            <span className="min-w-36 text-center text-sm font-medium text-surface-foreground">
                {date.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                })}
            </span>

            <button
                type="submit"
                name="dateUp"
                value="1"
                aria-label="Next day"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <ChevronRight className="h-5 w-5" />
            </button>
        </form>
    )
}