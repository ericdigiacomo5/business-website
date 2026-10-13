import type { Artist } from "@/generated/prisma/client"
import { SLOT_MINUTES, timeStringToDate, type ArtistTimeOff, type ArtistWorkingWindow } from "@/lib/schedule-grid"
import { Badge } from "@/components/ui/badge"
import { ScheduleBlock } from "./schedule-block"
import { ARTIST_COLOR_CYCLE, type AdminAppointment } from "./appointment-shared"

function toMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number)
    return hours * 60 + minutes
}

function toTimeString(minutes: number): string {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

export function ScheduleArtistColumn({
    artist,
    columnIndex,
    workingWindow,
    timeOff,
    appointments,
    gridStartMinutes,
    totalRows,
    date,
    onSelect,
    onBookSlot,
}: {
    artist: Artist
    columnIndex: number
    workingWindow: ArtistWorkingWindow
    timeOff: ArtistTimeOff[]
    appointments: AdminAppointment[]
    gridStartMinutes: number
    totalRows: number
    date: Date
    onSelect: (id: string) => void
    // Clicking an empty cell inside the artist's working hours starts a
    // booking for that artist at that time.
    onBookSlot: (artistId: string, startTime: Date) => void
}) {
    const color = ARTIST_COLOR_CYCLE[columnIndex % ARTIST_COLOR_CYCLE.length]
    const isOffToday = workingWindow.start === null || workingWindow.end === null
    const column = columnIndex + 2 // offset by 1 for the time-axis column (grid columns are 1-indexed)

    const windowStart = workingWindow.start ? toMinutes(workingWindow.start) : null
    const windowEnd = workingWindow.end ? toMinutes(workingWindow.end) : null

    // Cells under an appointment block stay plain: the block covers them for
    // a mouse, but a button there would still be reachable by keyboard.
    const occupied = new Set<number>()
    for (const appointment of appointments) {
        const start = new Date(appointment.startTime)
        const end = new Date(appointment.endTime)
        const startMinutes = start.getHours() * 60 + start.getMinutes()
        const slots = (end.getTime() - start.getTime()) / 60_000 / SLOT_MINUTES
        for (let i = 0; i < slots; i++) occupied.add(startMinutes + i * SLOT_MINUTES)
    }

    // Time off, clipped to the rows this grid actually draws (a closure can
    // run 00:00-23:45 while the grid only spans working hours).
    const gridEndMinutes = gridStartMinutes + totalRows * SLOT_MINUTES
    const timeOffBlocks = timeOff
        .map((entry) => ({
            ...entry,
            from: Math.max(toMinutes(entry.start), gridStartMinutes),
            to: Math.min(toMinutes(entry.end), gridEndMinutes),
        }))
        .filter((entry) => entry.from < entry.to)
    const isTimeOff = (minutes: number) => timeOffBlocks.some((entry) => minutes >= entry.from && minutes < entry.to)

    return (
        <>
            <div
                style={{ gridColumn: column, gridRow: 1 }}
                className={`sticky top-0 z-10 flex flex-col items-center justify-center gap-1 border-b border-border px-2 py-2 ${
                    isOffToday ? "bg-muted" : color.header
                }`}
            >
                <span className="truncate text-sm font-medium">{artist.name}</span>
                {isOffToday && <Badge tone="muted">Off today</Badge>}
            </div>

            {Array.from({ length: totalRows }, (_, i) => {
                const minutes = gridStartMinutes + i * SLOT_MINUTES
                const style = { gridColumn: column, gridRow: i + 2 }
                // The grid spans every artist's hours, so a cell can be
                // outside this particular artist's own window. Service length
                // isn't known here — the booking routes still check real
                // availability; this only decides which cells offer the
                // click.
                const inWorkingHours =
                    windowStart !== null && windowEnd !== null && minutes >= windowStart && minutes < windowEnd

                if (!inWorkingHours) {
                    return <div key={i} style={style} className="border-b border-border bg-muted/40" />
                }
                // Booking would be refused here (getOpenSlots blocks the same
                // ranges), so don't offer it; the time-off block drawn below
                // covers these cells and says why.
                if (occupied.has(minutes) || isTimeOff(minutes)) {
                    return <div key={i} style={style} className="border-b border-border" />
                }

                const startTime = timeStringToDate(date, toTimeString(minutes))
                return (
                    <button
                        key={i}
                        type="button"
                        style={style}
                        onClick={() => onBookSlot(artist.id, startTime)}
                        aria-label={`Book ${artist.name} at ${startTime.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                        })}`}
                        className="cursor-pointer border-b border-border hover:bg-accent/15 focus-visible:bg-accent/15 focus-visible:outline-none"
                    />
                )
            })}

            {/* Before the appointment blocks so a booking that predates a
                closure still renders on top of it and stays clickable —
                adding time off doesn't cancel what's already booked. */}
            {timeOffBlocks.map((entry) => (
                <div
                    key={`${entry.from}-${entry.to}-${entry.salonWide}`}
                    style={{
                        gridColumn: column,
                        gridRow: `${2 + (entry.from - gridStartMinutes) / SLOT_MINUTES} / span ${(entry.to - entry.from) / SLOT_MINUTES}`,
                        backgroundImage:
                            "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, currentColor 14%, transparent) 6px 7px)",
                    }}
                    className="overflow-hidden border-b border-border bg-muted px-2 py-1 text-muted-foreground"
                >
                    <span className="block truncate text-xs font-medium">
                        {entry.salonWide ? "Salon closed" : "Time off"}
                    </span>
                </div>
            ))}

            {appointments.map((appointment) => (
                <ScheduleBlock
                    key={appointment.id}
                    appointment={appointment}
                    gridStartMinutes={gridStartMinutes}
                    colorIndex={columnIndex}
                    column={column}
                    onSelect={onSelect}
                />
            ))}
        </>
    )
}
