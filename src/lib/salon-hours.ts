// Opening hours, derived — server-only. The salon's hours on a weekday are
// the earliest start to the latest end across its active artists'
// availability, so they can never disagree with what's bookable (and need
// no separate setting to keep in step). A salon-wide closure covering the
// whole of today closes today. Shown in the footer (FEATURE_GAPS.md U9).

import { prisma } from "@/lib/prisma"
import { endOfDay, startOfDay, timeOffDateRangeOverlap } from "@/lib/availability"

export type DayHours = { dayOfWeek: number; open: string; close: string } | { dayOfWeek: number; open: null; close: null }

export type SalonHours = {
    // Sunday (0) to Saturday (6).
    week: DayHours[]
    today: DayHours
    // A salon-wide closure covers all of today's hours.
    closedToday: boolean
}

export async function getSalonHours(now: Date = new Date()): Promise<SalonHours> {
    const [rows, closures] = await Promise.all([
        prisma.availability.findMany({
            where: { artist: { active: true } },
            select: { dayOfWeek: true, startTime: true, endTime: true },
        }),
        prisma.timeOff.findMany({
            where: { AND: [{ artistId: null }, timeOffDateRangeOverlap(startOfDay(now), endOfDay(now))] },
            select: { startTime: true, endTime: true },
        }),
    ])

    // "HH:mm" strings compare correctly as text (always zero-padded).
    const week: DayHours[] = Array.from({ length: 7 }, (_, dayOfWeek) => {
        const day = rows.filter((row) => row.dayOfWeek === dayOfWeek)
        if (day.length === 0) return { dayOfWeek, open: null, close: null }
        return {
            dayOfWeek,
            open: day.reduce((min, row) => (row.startTime < min ? row.startTime : min), day[0].startTime),
            close: day.reduce((max, row) => (row.endTime > max ? row.endTime : max), day[0].endTime),
        }
    })

    const today = week[now.getDay()]
    const closedToday =
        today.open !== null && closures.some((closure) => closure.startTime <= today.open && closure.endTime >= today.close)

    return { week, today, closedToday }
}
