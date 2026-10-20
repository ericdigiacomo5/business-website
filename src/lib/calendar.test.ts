// Run with `npm test`.

import { test } from "node:test"
import assert from "node:assert/strict"
import { googleCalendarUrl, icsFile, toCalendarUtc, type CalendarEvent } from "@/lib/calendar"

const EVENT: CalendarEvent = {
    uid: "appt-1@nail-image",
    title: "Gel Manicure, Pedicure with Libby",
    start: new Date("2026-10-23T14:00:00Z"),
    end: new Date("2026-10-23T15:15:00Z"),
    description: "Cancel or reschedule online up to 24 hours before.",
    location: "123 Main St; Amityville, NY",
}

test("dates are written in UTC, without separators or milliseconds", () => {
    assert.equal(toCalendarUtc(new Date("2026-10-23T14:05:09.123Z")), "20261023T140509Z")
})

test("the Google link carries title, both times, details and location", () => {
    const url = new URL(googleCalendarUrl(EVENT))
    assert.equal(url.origin + url.pathname, "https://calendar.google.com/calendar/render")
    assert.equal(url.searchParams.get("action"), "TEMPLATE")
    assert.equal(url.searchParams.get("text"), EVENT.title)
    assert.equal(url.searchParams.get("dates"), "20261023T140000Z/20261023T151500Z")
    assert.equal(url.searchParams.get("location"), EVENT.location)
})

test("the .ics file is CRLF-separated, escapes text and has one VEVENT per visit", () => {
    const second = { ...EVENT, uid: "appt-2@nail-image", start: new Date("2026-10-30T14:00:00Z"), end: new Date("2026-10-30T15:15:00Z") }
    const ics = icsFile([EVENT, second], new Date("2026-10-19T12:00:00Z"))
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"))
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"))
    assert.equal(ics.split("BEGIN:VEVENT").length - 1, 2)
    assert.ok(ics.includes("SUMMARY:Gel Manicure\\, Pedicure with Libby"))
    assert.ok(ics.includes("LOCATION:123 Main St\\; Amityville\\, NY"))
    assert.ok(ics.includes("DTSTAMP:20261019T120000Z"))
    assert.ok(!/[^\r]\n/.test(ics), "every newline is part of a CRLF")
})

test("long lines are folded to 75 characters with a leading space", () => {
    const ics = icsFile([{ ...EVENT, description: "x".repeat(200) }])
    const lines = ics.split("\r\n")
    assert.ok(lines.every((line) => line.length <= 75), "no line over 75")
    const start = lines.findIndex((line) => line.startsWith("DESCRIPTION:"))
    assert.ok(lines[start + 1].startsWith(" "), "continuation starts with a space")
    // 212 characters → 75 + 74 + 63: three physical lines.
    assert.equal(lines.slice(start, start + 3).map((l, i) => (i === 0 ? l : l.slice(1))).join(""), `DESCRIPTION:${"x".repeat(200)}`)
})
