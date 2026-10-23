// Run with `npm test`. The timezone fix (docs/DEPLOY_RUNBOOK.md §6): every
// date helper must give the salon's (New York) answer no matter which zone
// the process runs in. Workers run in UTC; a dev laptop runs in New York; a
// browser can be anywhere. So each check runs once per zone below — Node
// applies a change to process.env.TZ immediately.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
    calendarDateKey,
    dateKeyParts,
    daysInMonth,
    formatSalonDate,
    formatSalonTime,
    salonMinutesOfDay,
    salonWeekday,
    zonedParts,
    zonedToInstant,
} from "@/lib/salon-time"
import { endOfDay, isOnSlotBoundary, partOfDay, startOfDay, startOfWeek, timeStringToDate } from "@/lib/schedule-grid"
import { addDays, bookingWindowEnd, generateOccurrenceDates } from "@/lib/recurring"
import { formatOpening, parseLocalDate, toLocalDateKey, toLocalTimeKey } from "@/lib/format"

const ZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Kiritimati"]

function inEveryZone(name: string, check: () => void) {
    test(name, () => {
        const original = process.env.TZ
        try {
            for (const zone of ZONES) {
                process.env.TZ = zone
                try {
                    check()
                } catch (error) {
                    throw new Error(`[TZ=${zone}] ${(error as Error).message}`)
                }
            }
        } finally {
            if (original === undefined) delete process.env.TZ
            else process.env.TZ = original
        }
    })
}

const iso = (date: Date) => date.toISOString()
// The salon's midnight at the start of 2026-10-22 (a Thursday, EDT = UTC−4).
const OCT_22 = parseLocalDate("2026-10-22")!

inEveryZone("a salon-wide closure blocks exactly its New York hours", () => {
    // Entered as 09:00–18:00. Before the fix, on a UTC server this blocked
    // 04:00–13:00 New York time and left the afternoon bookable.
    assert.equal(iso(timeStringToDate(OCT_22, "09:00")), "2026-10-22T13:00:00.000Z")
    assert.equal(iso(timeStringToDate(OCT_22, "18:00")), "2026-10-22T22:00:00.000Z")
    // Winter is UTC−5.
    const jan15 = parseLocalDate("2026-01-15")!
    assert.equal(iso(timeStringToDate(jan15, "09:00")), "2026-01-15T14:00:00.000Z")
})

inEveryZone("day boundaries are the salon's midnights, including DST days", () => {
    assert.equal(iso(OCT_22), "2026-10-22T04:00:00.000Z")
    assert.equal(iso(startOfDay(new Date("2026-10-23T03:30:00Z"))), "2026-10-22T04:00:00.000Z")
    assert.equal(iso(endOfDay(OCT_22)), "2026-10-23T03:59:59.999Z")

    // 2026-03-08: clocks spring forward, a 23-hour day.
    const springForward = parseLocalDate("2026-03-08")!
    assert.equal(iso(springForward), "2026-03-08T05:00:00.000Z")
    assert.equal(iso(endOfDay(springForward)), "2026-03-09T03:59:59.999Z")
    // 2026-11-01: clocks fall back, a 25-hour day.
    const fallBack = parseLocalDate("2026-11-01")!
    assert.equal(iso(fallBack), "2026-11-01T04:00:00.000Z")
    assert.equal(iso(endOfDay(fallBack)), "2026-11-02T04:59:59.999Z")
})

inEveryZone("slot times on the DST change days keep their wall-clock hour", () => {
    const springForward = parseLocalDate("2026-03-08")!
    assert.equal(iso(timeStringToDate(springForward, "09:00")), "2026-03-08T13:00:00.000Z")
    assert.equal(formatSalonTime(timeStringToDate(springForward, "09:00")), "9:00 AM")

    const fallBack = parseLocalDate("2026-11-01")!
    assert.equal(iso(timeStringToDate(fallBack, "09:00")), "2026-11-01T14:00:00.000Z")
    assert.equal(formatSalonTime(timeStringToDate(fallBack, "17:45")), "5:45 PM")
})

inEveryZone("toLocalDateKey and toLocalTimeKey read the salon's clock", () => {
    // 23:30 Thursday in New York is already Friday in UTC.
    const lateThursday = new Date("2026-10-23T03:30:00Z")
    assert.equal(toLocalDateKey(lateThursday), "2026-10-22")
    assert.equal(toLocalTimeKey(lateThursday), "23:30")
    assert.equal(salonWeekday(lateThursday), 4)
    assert.equal(salonMinutesOfDay(lateThursday), 23 * 60 + 30)
    assert.equal(partOfDay(lateThursday), "Evening")
    assert.equal(formatSalonDate(lateThursday, { weekday: "short", month: "short", day: "numeric" }), "Thu, Oct 22")
})

inEveryZone("the 14-day booking window ends at the salon's midnight", () => {
    // Late on Oct 22: the window is Oct 22 through Nov 4, so it ends at the
    // start of Nov 5 — after the fall-back change, so UTC−5.
    assert.equal(iso(bookingWindowEnd(new Date("2026-10-23T03:30:00Z"))), "2026-11-05T05:00:00.000Z")
})

inEveryZone("addDays and weekly series keep the same wall-clock time across DST", () => {
    const tuesday10am = new Date("2026-10-27T14:00:00Z") // 10 AM EDT
    assert.equal(iso(addDays(tuesday10am, 7)), "2026-11-03T15:00:00.000Z") // 10 AM EST

    const dates = generateOccurrenceDates(parseLocalDate("2026-10-20")!, 1, parseLocalDate("2026-11-10")!)
    assert.deepEqual(dates.map(toLocalDateKey), ["2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"])
    assert.deepEqual(
        dates.map((d) => iso(timeStringToDate(d, "10:00"))),
        ["2026-10-20T14:00:00.000Z", "2026-10-27T14:00:00.000Z", "2026-11-03T15:00:00.000Z", "2026-11-10T15:00:00.000Z"],
    )
})

inEveryZone("weeks start on the salon's Sunday", () => {
    assert.equal(toLocalDateKey(startOfWeek(new Date("2026-10-23T03:30:00Z"))), "2026-10-18")
    assert.equal(iso(startOfWeek(OCT_22)), "2026-10-18T04:00:00.000Z")
})

inEveryZone("parseLocalDate refuses dates that don't exist", () => {
    assert.equal(parseLocalDate("2026-02-30"), null)
    assert.equal(parseLocalDate("2026-13-01"), null)
    assert.equal(parseLocalDate("not a date"), null)
    assert.equal(dateKeyParts("2028-02-29")?.day, 29)
    assert.equal(daysInMonth(2028, 2), 29)
    assert.equal(calendarDateKey(2026, 13, 1), "2027-01-01")
})

inEveryZone("isOnSlotBoundary checks the 15-minute grid", () => {
    assert.equal(isOnSlotBoundary(new Date("2026-10-22T13:45:00Z")), true)
    assert.equal(isOnSlotBoundary(new Date("2026-10-22T13:50:00Z")), false)
    assert.equal(isOnSlotBoundary(new Date("2026-10-22T13:45:01Z")), false)
    assert.equal(isOnSlotBoundary(new Date("garbage")), false)
})

inEveryZone("formatOpening says Today and Tomorrow by the salon's calendar", () => {
    const now = new Date("2026-10-23T01:00:00Z") // 9 PM Thursday in New York
    assert.equal(formatOpening(new Date("2026-10-23T13:00:00Z"), now), "Tomorrow 9 AM")
    assert.equal(formatOpening(new Date("2026-10-23T01:30:00Z"), now), "Today 9:30 PM")
})

inEveryZone("zonedToInstant round-trips through zonedParts", () => {
    for (const isoString of ["2026-01-01T05:00:00.000Z", "2026-07-04T16:15:00.000Z", "2026-12-31T23:59:00.000Z"]) {
        const p = zonedParts(new Date(isoString))
        assert.equal(iso(zonedToInstant(p.year, p.month, p.day, p.hour, p.minute, p.second)), isoString)
    }
})
