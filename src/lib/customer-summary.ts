// A customer's history in numbers (FEATURE_GAPS.md Gap 28): the summary on
// the admin customer page, and the repeat no-show flag on the schedule.
// Pure and client-safe (type-only Prisma import), so it's unit-tested and
// the schedule sheets can use the same threshold.

import type { AppointmentStatus, DiscountType } from "@/generated/prisma/client"
import { servicesPriceCents } from "@/lib/appointment-services"
import { discountOf, totalCents } from "@/lib/discount"

// At this many no-shows the schedule flags the customer, so the front desk
// can call ahead to confirm. Two, not one: anyone can miss one visit.
export const NO_SHOW_FLAG_THRESHOLD = 2

export function isNoShowFlagged(noShows: number): boolean {
    return noShows >= NO_SHOW_FLAG_THRESHOLD
}

export function noShowLabel(noShows: number): string {
    return `${noShows} no-show${noShows === 1 ? "" : "s"}`
}

export type SummaryAppointment = {
    status: AppointmentStatus
    startTime: Date | string
    discountType: DiscountType | null
    discountValue: number | null
    artist: { name: string }
    services: { priceCents: number; service: { name: string } }[]
}

export type CustomerSummary = {
    // Completed visits only.
    visits: number
    // What completed visits came to after discounts (store credit, gift
    // cards and Groupon count at face value, as in the pay report).
    spentCents: number
    averageCents: number | null
    lastVisit: Date | null
    nextVisit: Date | null
    // The artist they've had most often; ties go to the most recent.
    usualArtist: string | null
    // Up to three, most-booked first; ties go to the most recent.
    topServices: string[]
    noShows: number
    cancellations: number
    // Share of visits they were expected at that they missed:
    // no-shows ÷ (completed + no-shows). null before either has happened.
    noShowRate: number | null
}

const TOP_SERVICES = 3

// Ranks names by how often they appear; `names` must be most-recent first,
// so on a tie the one seen first (most recently) wins.
function byFrequency(names: string[]): string[] {
    const counts = new Map<string, number>()
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
    // Map keeps first-insertion order and sort is stable, so ties keep it.
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

export function summarizeCustomer(appointments: SummaryAppointment[], now: Date = new Date()): CustomerSummary {
    const sorted = [...appointments].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    const completed = sorted.filter((a) => a.status === "COMPLETED")

    const spentCents = completed.reduce(
        (sum, a) => sum + totalCents(servicesPriceCents(a.services), discountOf(a)),
        0
    )
    const noShows = sorted.filter((a) => a.status === "NO_SHOW").length

    const upcoming = sorted.filter(
        (a) => (a.status === "PENDING" || a.status === "CONFIRMED") && new Date(a.startTime) > now
    )

    const expected = completed.length + noShows

    return {
        visits: completed.length,
        spentCents,
        averageCents: completed.length > 0 ? Math.round(spentCents / completed.length) : null,
        lastVisit: completed.length > 0 ? new Date(completed[0].startTime) : null,
        nextVisit: upcoming.length > 0 ? new Date(upcoming[upcoming.length - 1].startTime) : null,
        usualArtist: byFrequency(completed.map((a) => a.artist.name))[0] ?? null,
        topServices: byFrequency(completed.flatMap((a) => a.services.map((line) => line.service.name))).slice(0, TOP_SERVICES),
        noShows,
        cancellations: sorted.filter((a) => a.status === "CANCELLED").length,
        noShowRate: expected > 0 ? noShows / expected : null,
    }
}
