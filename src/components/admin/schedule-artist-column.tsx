import type { Artist } from "@/generated/prisma/client"
import type { ArtistWorkingWindow } from "@/lib/schedule-grid"
import { Badge } from "@/components/ui/badge"
import { ScheduleBlock } from "./schedule-block"
import { ARTIST_COLOR_CYCLE, type AdminAppointment } from "./appointment-shared"

export function ScheduleArtistColumn({
    artist,
    columnIndex,
    workingWindow,
    appointments,
    gridStartMinutes,
    totalRows,
    onSelect,
}: {
    artist: Artist
    columnIndex: number
    workingWindow: ArtistWorkingWindow
    appointments: AdminAppointment[]
    gridStartMinutes: number
    totalRows: number
    onSelect: (id: string) => void
}) {
    const color = ARTIST_COLOR_CYCLE[columnIndex % ARTIST_COLOR_CYCLE.length]
    const isOffToday = workingWindow.start === null || workingWindow.end === null
    const column = columnIndex + 2 // offset by 1 for the time-axis column (grid columns are 1-indexed)

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

            {Array.from({ length: totalRows }, (_, i) => (
                <div
                    key={i}
                    style={{ gridColumn: column, gridRow: i + 2 }}
                    className={`border-b border-border ${isOffToday ? "bg-muted/40" : ""}`}
                />
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
