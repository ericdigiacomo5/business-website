import { useEffect, useMemo, useState } from "react"
import { DayStrip } from "./day-strip"
import { SlotGrid } from "./slot-grid"
import { Spinner } from "@/components/ui/spinner"
import { toLocalDateKey } from "@/lib/format"

const DAYS_AHEAD = 14
const SLOT_MINUTES = 15

// A slot is only offered if the full service duration fits without running
// past the artist's availability, into a time-off block, or into an existing
// booking — i.e. every 15-minute increment the service needs is itself an
// open slot. `slots` is already the fully-open set for the day (getOpenSlots
// already subtracts time-off and bookings), so checking consecutive
// membership here is both necessary and sufficient — no need to separately
// know the artist's raw availability end time. Mirrors the same check
// POST /api/appointments does server-side (isFullyAvailable).
function filterFittableSlots(slots: string[], durationMinutes: number): string[] {
    const openTimes = new Set(slots.map((s) => new Date(s).getTime()))
    const slotsNeeded = Math.ceil(durationMinutes / SLOT_MINUTES)

    return slots.filter((slot) => {
        const start = new Date(slot).getTime()
        for (let i = 0; i < slotsNeeded; i++) {
            if (!openTimes.has(start + i * SLOT_MINUTES * 60_000)) {
                return false
            }
        }
        return true
    })
}

// Keyed by `date` (and now `serviceDurationMinutes`) in the parent so a
// change remounts this component — loading state then comes from useState's
// initial value, not a synchronous setState call inside the effect (which
// eslint-plugin-react-hooks flags as a cascading-render anti-pattern).
function SlotFetcher({
    artistId,
    date,
    serviceDurationMinutes,
    onSelect,
}: {
    artistId: string
    date: string
    serviceDurationMinutes: number
    onSelect: (startTime: string) => void
}) {
    const [slots, setSlots] = useState<string[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        fetch(`/api/artists/${artistId}/availability?date=${date}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load availability")
                return res.json() as Promise<string[]>
            })
            .then((data) => {
                if (!cancelled) setSlots(filterFittableSlots(data, serviceDurationMinutes))
            })
            .catch(() => {
                if (!cancelled) setError("Couldn't load open times. Please try again.")
            })

        return () => {
            cancelled = true
        }
    }, [artistId, date, serviceDurationMinutes])

    if (error) {
        return <p className="mt-4 text-sm text-danger">{error}</p>
    }

    if (slots === null) {
        return (
            <div className="mt-6 flex justify-center">
                <Spinner className="h-6 w-6 text-primary" />
            </div>
        )
    }

    return <SlotGrid slots={slots} selectedTime={null} onSelect={onSelect} />
}

export function DateTimeStep({
    artistId,
    initialDate,
    serviceDurationMinutes,
    onSelect,
}: {
    artistId: string
    initialDate: string | null
    serviceDurationMinutes: number
    onSelect: (date: string, startTime: string) => void
}) {
    const days = useMemo(() => {
        const today = new Date()
        return Array.from({ length: DAYS_AHEAD }, (_, i) => {
            const d = new Date(today)
            d.setDate(d.getDate() + i)
            return d
        })
    }, [])

    const [selectedDate, setSelectedDate] = useState(initialDate ?? toLocalDateKey(days[0]))

    return (
        <div>
            <h2 className="text-lg font-semibold text-foreground">Choose a Date &amp; Time</h2>
            <div className="mt-4">
                <DayStrip days={days} selectedDate={selectedDate} onSelect={setSelectedDate} />
            </div>

            <SlotFetcher
                key={selectedDate}
                artistId={artistId}
                date={selectedDate}
                serviceDurationMinutes={serviceDurationMinutes}
                onSelect={(startTime) => onSelect(selectedDate, startTime)}
            />
        </div>
    )
}