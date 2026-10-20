// "Add to calendar" for a booking (FEATURE_GAPS.md U7, Gap 20) — pure and
// client-safe. Two forms: a Google Calendar link (one event), and an .ics
// file (RFC 5545) that Apple Calendar, Outlook and Google all import, which
// can hold every visit of a standing appointment.

export type CalendarEvent = {
    // Stable per appointment, so importing the file twice updates rather than
    // duplicates the event.
    uid: string
    title: string
    start: Date
    end: Date
    description?: string
    location?: string
}

// 20261023T140000Z — UTC, the form both Google and .ics accept everywhere.
export function toCalendarUtc(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

export function googleCalendarUrl(event: CalendarEvent): string {
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title,
        dates: `${toCalendarUtc(event.start)}/${toCalendarUtc(event.end)}`,
    })
    if (event.description) params.set("details", event.description)
    if (event.location) params.set("location", event.location)
    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Text values escape backslash, semicolon, comma and newlines (RFC 5545
// §3.3.11).
function escapeText(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

// Lines longer than 75 octets are folded: CRLF then a space (§3.1). Counted
// in characters, which is exact for the ASCII this app produces and errs
// short (still valid) otherwise.
function fold(line: string): string {
    if (line.length <= 75) return line
    const parts = [line.slice(0, 75)]
    for (let i = 75; i < line.length; i += 74) parts.push(` ${line.slice(i, i + 74)}`)
    return parts.join("\r\n")
}

export function icsFile(events: CalendarEvent[], now: Date = new Date()): string {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nail Image Inc.//Booking//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
    for (const event of events) {
        lines.push(
            "BEGIN:VEVENT",
            `UID:${event.uid}`,
            `DTSTAMP:${toCalendarUtc(now)}`,
            `DTSTART:${toCalendarUtc(event.start)}`,
            `DTEND:${toCalendarUtc(event.end)}`,
            `SUMMARY:${escapeText(event.title)}`,
            ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
            ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
            "END:VEVENT"
        )
    }
    lines.push("END:VCALENDAR")
    return lines.map(fold).join("\r\n") + "\r\n"
}
