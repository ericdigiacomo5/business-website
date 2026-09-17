import { SLOT_MINUTES } from "@/lib/schedule-grid"
import { ARTIST_COLOR_CYCLE, STATUS_BAR_COLOR, type AdminAppointment } from "./appointment-shared"

export function ScheduleBlock({
    appointment,
    gridStartMinutes,
    colorIndex,
    column,
    onSelect,
}: {
    appointment: AdminAppointment
    gridStartMinutes: number
    colorIndex: number
    column: number
    onSelect: (id: string) => void
}) {
    const start = new Date(appointment.startTime)
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const durationMinutes = (new Date(appointment.endTime).getTime() - start.getTime()) / 60_000

    // Both are exact multiples of SLOT_MINUTES — every appointment is booked
    // on the 15-minute slot grid (AppointmentSlot rows), so this division is
    // always a whole number, never rounded/clamped. +2, not +1: row 1 is the
    // header row (shared by every column, see schedule-artist-column.tsx and
    // schedule-time-axis.tsx), so the first time slot starts at row 2.
    const startRow = 2 + (startMinutes - gridStartMinutes) / SLOT_MINUTES
    const rowSpan = durationMinutes / SLOT_MINUTES

    const color = ARTIST_COLOR_CYCLE[colorIndex % ARTIST_COLOR_CYCLE.length]

    return (
        <button
            type="button"
            onClick={() => onSelect(appointment.id)}
            style={{ gridColumn: column, gridRow: `${startRow} / span ${rowSpan}` }}
            className={
                "relative flex cursor-pointer flex-col overflow-hidden rounded-sm border px-2 py-1 text-left " +
                `${color.block} ${color.blockBorder}`
            }
        >
            <span
                className={`absolute inset-y-0 left-0 w-1 ${STATUS_BAR_COLOR[appointment.status]}`}
                aria-hidden
            />
            <span className="truncate pl-1.5 text-xs font-medium text-surface-foreground">
                {appointment.service.name}
            </span>
            <span className="truncate pl-1.5 text-xs text-muted-foreground">
                {appointment.user.name ?? appointment.user.email}
            </span>
        </button>
    )
}
