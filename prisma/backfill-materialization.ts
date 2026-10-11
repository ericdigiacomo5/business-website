// One-off, idempotent backfill for the rolling-materialization fields
// (PLAN_RECURRING_MATERIALIZATION.md). Run between the two migrations:
//
//   npx tsx --env-file=.env prisma/backfill-materialization.ts
//
// (--env-file because plain `npx tsx` skips prisma.config.ts's dotenv load.)
//
// Only touches rows whose new fields are still null, so re-running is safe.
// Computed in TypeScript with the app's own local-time helpers — never SQL
// date_trunc, which would compute UTC days and silently disagree with the
// keys the app writes.
import { prisma } from "../src/lib/prisma"
import { toLocalDateKey } from "../src/lib/format"
import { startOfDay } from "../src/lib/availability"
import { MATERIALIZE_WEEKS } from "../src/lib/recurring"

async function main() {
    // occurrenceDate for every existing occurrence of a series. Known,
    // accepted inaccuracy: an occurrence already rescheduled to a different
    // day gets its *new* day (the original isn't recorded anywhere). The
    // watermark below still keeps the scheduled job from revisiting it.
    const occurrences = await prisma.appointment.findMany({
        where: { recurringAppointmentId: { not: null }, occurrenceDate: null },
        select: { id: true, recurringAppointmentId: true, startTime: true },
    })

    // Two rows of one series on the same day would violate the unique
    // constraint the next migration adds — log them and leave them null
    // rather than guess which one is "the" occurrence.
    const byKey = new Map<string, string[]>()
    for (const o of occurrences) {
        const key = `${o.recurringAppointmentId}|${toLocalDateKey(o.startTime)}`
        byKey.set(key, [...(byKey.get(key) ?? []), o.id])
    }

    let updated = 0
    const collisions: { key: string; ids: string[] }[] = []
    for (const [key, ids] of byKey) {
        if (ids.length > 1) {
            collisions.push({ key, ids })
            continue
        }
        const [, occurrenceDate] = key.split("|")
        await prisma.appointment.update({ where: { id: ids[0] }, data: { occurrenceDate } })
        updated++
    }

    // Watermark = the horizon the creation route evaluated when the series
    // was created, since that's how far it was actually materialized.
    const series = await prisma.recurringAppointment.findMany({
        where: { materializedThrough: null },
        select: { id: true, createdAt: true },
    })
    for (const s of series) {
        const horizon = startOfDay(new Date(s.createdAt.getTime() + MATERIALIZE_WEEKS * 7 * 24 * 60 * 60 * 1000))
        await prisma.recurringAppointment.update({ where: { id: s.id }, data: { materializedThrough: horizon } })
    }

    console.log(`occurrenceDate set on ${updated} of ${occurrences.length} recurring appointments`)
    console.log(`materializedThrough set on ${series.length} series`)
    if (collisions.length > 0) {
        console.warn(`${collisions.length} same-day collisions left null — resolve before adding the unique constraint:`)
        for (const c of collisions) console.warn(`  ${c.key}: ${c.ids.join(", ")}`)
        process.exitCode = 1
    }
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
