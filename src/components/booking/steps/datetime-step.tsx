import { useEffect, useMemo, useState } from "react"
import { ArrowRight } from "lucide-react"
import { DayStrip } from "./day-strip"
import { SlotGrid } from "./slot-grid"
import { Spinner } from "@/components/ui/spinner"
import { formatOpening, toLocalDateKey } from "@/lib/format"
import { fittingStarts } from "@/lib/schedule-grid"
import { BOOKING_WINDOW_DAYS, addDays } from "@/lib/recurring"

// Keyed by `date` (and now `serviceDurationMinutes`) in the parent so a
// change remounts this component — loading state then comes from useState's
// initial value, not a synchronous setState call inside the effect (which
// eslint-plugin-react-hooks flags as a cascading-render anti-pattern).
function SlotFetcher({
    artistId,
    date,
    serviceDurationMinutes,
    excludeAppointmentId,
    emptyMessage,
    onSelect,
}: {
    artistId: string
    date: string
    serviceDurationMinutes: number
    excludeAppointmentId?: string
    emptyMessage: React.ReactNode
    onSelect: (startTime: string) => void
}) {
    const [slots, setSlots] = useState<string[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        const url = `/api/artists/${artistId}/availability?date=${date}`
        // Only passed when rescheduling (admin, or a customer moving their
        // own booking) — the API ignores it for anyone else.
        fetch(excludeAppointmentId ? `${url}&excludeAppointmentId=${excludeAppointmentId}` : url)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load availability")
                return res.json() as Promise<{ data: string[] }>
            })
            .then((body) => {
                // Only starts where the whole visit fits — the same rule the
                // booking routes apply (fittingStarts in schedule-grid.ts).
                const open = body.data.map((slot) => new Date(slot))
                if (!cancelled) setSlots(fittingStarts(open, serviceDurationMinutes).map((slot) => slot.toISOString()))
            })
            .catch(() => {
                if (!cancelled) setError("Couldn't load open times. Please try again.")
            })

        return () => {
            cancelled = true
        }
    }, [artistId, date, serviceDurationMinutes, excludeAppointmentId])

    if (error) {
        return <p role="alert" className="mt-4 text-sm text-danger">{error}</p>
    }

    if (slots === null) {
        return (
            <div className="mt-6 flex justify-center">
                <Spinner className="h-6 w-6 text-primary" />
            </div>
        )
    }

    return <SlotGrid slots={slots} selectedTime={null} onSelect={onSelect} emptyMessage={emptyMessage} />
}

// dateKey → first fitting start (ISO), for the days in the window that have
// one. `failed` = couldn't load: then no day is greyed out, as before.
type OpenDays = { key: string; days: Map<string, string> | null; failed: boolean }

export function DateTimeStep({
    artistId,
    initialDate,
    serviceDurationMinutes,
    excludeAppointmentId,
    heading = "Choose a Date & Time",
    daysAhead = BOOKING_WINDOW_DAYS,
    onSelect,
}: {
    artistId: string
    initialDate: string | null
    serviceDurationMinutes: number
    excludeAppointmentId?: string
    heading?: string
    // Defaults to the customer booking window the server enforces. Admin
    // callers (reschedule) pass a wider value — admins are
    // exempt from the window, and a strip capped at 14 days would quietly
    // apply it to them anyway.
    daysAhead?: number
    onSelect: (date: string, startTime: string) => void
}) {
    const days = useMemo(() => {
        const today = new Date()
        return Array.from({ length: daysAhead }, (_, i) => addDays(today, i))
    }, [daysAhead])

    // Which days have an opening, fetched once for the whole strip
    // (FEATURE_GAPS.md U6). Stored with the request it answers, so a stale
    // answer (the services changed) reads as still loading.
    const requestKey = `${artistId}|${serviceDurationMinutes}|${daysAhead}|${excludeAppointmentId ?? ""}`
    const [openDays, setOpenDays] = useState<OpenDays>({ key: "", days: null, failed: false })
    useEffect(() => {
        let cancelled = false
        const query = new URLSearchParams({ durationMinutes: String(serviceDurationMinutes), days: String(daysAhead) })
        if (excludeAppointmentId) query.set("excludeAppointmentId", excludeAppointmentId)
        fetch(`/api/artists/${artistId}/open-days?${query.toString()}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load open days")
                return res.json() as Promise<{ data: { date: string; firstStart: string }[] }>
            })
            .then((body) => {
                if (!cancelled) setOpenDays({ key: requestKey, days: new Map(body.data.map((d) => [d.date, d.firstStart])), failed: false })
            })
            .catch(() => {
                if (!cancelled) setOpenDays({ key: requestKey, days: null, failed: true })
            })
        return () => {
            cancelled = true
        }
    }, [requestKey, artistId, serviceDurationMinutes, daysAhead, excludeAppointmentId])

    const loaded = openDays.key === requestKey
    const known = loaded && !openDays.failed ? openDays.days : null

    // Until the customer picks a day: the one they had, else the first day
    // with an opening (so they don't land on a full "today"), else today.
    const [chosenDate, setChosenDate] = useState(initialDate)
    const firstOpen = known ? (days.map(toLocalDateKey).find((key) => known.has(key)) ?? null) : null
    const selectedDate = chosenDate ?? (loaded ? (firstOpen ?? toLocalDateKey(days[0])) : null)

    // The first open day after the one showing, for the empty state.
    const nextOpen = known && selectedDate ? [...known.entries()].find(([key]) => key > selectedDate) : undefined
    const emptyMessage = nextOpen ? (
        <div className="mt-4 rounded-sm border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">No open times on this day.</p>
            <button
                type="button"
                onClick={() => setChosenDate(nextOpen[0])}
                className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-accent hover:text-primary-strong"
            >
                {`Next opening: ${formatOpening(new Date(nextOpen[1]))}`}
                <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
        </div>
    ) : known && known.size === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
            {`No openings in the next ${daysAhead} days. Try another artist, or contact the salon.`}
        </p>
    ) : undefined

    return (
        <div>
            <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
            <div className="mt-4">
                <DayStrip days={days} selectedDate={selectedDate} openDays={known ? new Set(known.keys()) : null} onSelect={setChosenDate} />
            </div>

            {selectedDate === null ? (
                <div className="mt-6 flex justify-center">
                    <Spinner className="h-6 w-6 text-primary" />
                </div>
            ) : (
                <SlotFetcher
                    key={`${selectedDate}|${serviceDurationMinutes}`}
                    artistId={artistId}
                    date={selectedDate}
                    serviceDurationMinutes={serviceDurationMinutes}
                    excludeAppointmentId={excludeAppointmentId}
                    emptyMessage={emptyMessage}
                    onSelect={(startTime) => onSelect(selectedDate, startTime)}
                />
            )}
        </div>
    )
}
