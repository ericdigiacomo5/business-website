'use client'

import { useSyncExternalStore } from "react"
import { SLOT_MINUTES } from "@/lib/schedule-grid"

// A minute-resolution clock shared by every subscriber. The server snapshot
// is null, so the line is never in the server HTML (the server's "now" and
// the browser's would disagree) and appears right after hydration.
function subscribe(onTick: () => void) {
    const interval = setInterval(onTick, 30_000)
    return () => clearInterval(interval)
}
const minuteOfDay = () => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
}

// The red "now" line across today's columns on the schedule grid
// (FEATURE_GAPS.md U13), so staff can see at a glance who's running late.
// Placed in the grid itself: the row the current time falls in, nudged down
// by how far into that 15-minute row it is.
export function ScheduleNowLine({
    gridStartMinutes,
    gridEndMinutes,
    firstColumn,
    lastColumn,
}: {
    gridStartMinutes: number
    gridEndMinutes: number
    // Grid column lines (1-based, the time axis is column 1) of today's
    // first and last artist/day columns.
    firstColumn: number
    lastColumn: number
}) {
    const minutes = useSyncExternalStore(subscribe, minuteOfDay, () => null)
    if (minutes === null || minutes < gridStartMinutes || minutes >= gridEndMinutes) return null

    const offset = minutes - gridStartMinutes
    const row = 2 + Math.floor(offset / SLOT_MINUTES)
    const fraction = (offset % SLOT_MINUTES) / SLOT_MINUTES

    return (
        <div
            aria-hidden
            className="pointer-events-none relative z-15 h-0.5 self-start bg-danger"
            style={{
                gridColumn: `${firstColumn} / ${lastColumn + 1}`,
                gridRow: `${row} / span 1`,
                marginTop: `calc(var(--schedule-row-height) * ${fraction})`,
            }}
        >
            <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-danger" />
        </div>
    )
}
