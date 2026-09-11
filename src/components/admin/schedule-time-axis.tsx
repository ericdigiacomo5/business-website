import { SLOT_MINUTES } from "@/lib/schedule-grid"

// Sticky mechanism: position: sticky + left: 0 on each cell. The nearest
// scrolling ancestor is the grid's own outer overflow-x-auto container (see
// schedule-grid.tsx), so this pins the axis to that container's left edge as
// artist columns scroll underneath — no separate table or dual-grid needed,
// sticky works per-cell inside a single CSS Grid just as well as per-column
// in a table. bg-background is required (not transparent), or columns would
// visibly scroll "through" the axis instead of behind it.
//
// Row 1 is the header row shared by every column (artist name / "Off today"
// badge) — the axis's row-1 cell is just its sticky top-left corner, blank.
// Time rows start at row 2 (see ScheduleBlock's startRow math, which shares
// this same +2 offset).
export function ScheduleTimeAxis({ gridStartMinutes, totalRows }: { gridStartMinutes: number; totalRows: number }) {
    return (
        <>
            <div
                style={{ gridColumn: 1, gridRow: 1 }}
                className="sticky top-0 left-0 z-20 border-b border-border bg-background"
            />

            {Array.from({ length: totalRows }, (_, i) => {
                const minutes = gridStartMinutes + i * SLOT_MINUTES
                const isHourMark = minutes % 60 === 0
                const isHalfHourMark = minutes % 30 === 0
                const label = isHourMark || isHalfHourMark ? formatMinutes(minutes) : null

                return (
                    <div
                        key={i}
                        style={{ gridColumn: 1, gridRow: i + 2 }}
                        className={
                            "sticky left-0 z-10 border-b border-border bg-background pr-2 text-right text-[11px] " +
                            "text-muted-foreground " +
                            (isHourMark ? "border-t border-t-border" : "")
                        }
                    >
                        {label}
                    </div>
                )
            })}
        </>
    )
}

function formatMinutes(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const period = hours >= 12 ? "PM" : "AM"
    const displayHour = hours % 12 === 0 ? 12 : hours % 12
    return minutes === 0 ? `${displayHour} ${period}` : `${displayHour}:${String(minutes).padStart(2, "0")}`
}
