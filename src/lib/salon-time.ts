// The salon's clock. Every conversion between an instant (a Date) and the
// salon's wall-clock time goes through this file, so the app gives the same
// answers on a server in UTC (Cloudflare Workers), on a laptop in New York,
// and in a customer's browser in any time zone.
//
// No time-zone library (a project decision): the two primitives below are
// built on Intl.DateTimeFormat, which every runtime here ships with the full
// time-zone database. Everything else (startOfDay, timeStringToDate,
// toLocalDateKey, ...) is built on these two.
//
// Client-safe: no server-only imports. The rule that keeps the fix contained
// is enforced by src/lib/salon-time-rules.test.ts: outside this file, no code
// reads or sets a Date's local fields (getHours, getDay, setDate, ...) or
// calls toLocale*String() without the salon's zone.

export const SALON_TIME_ZONE = "America/New_York"

// The calendar date and wall-clock time of an instant, in the salon's zone.
// month is 1–12, weekday 0 (Sunday) – 6 (Saturday).
export type ZonedParts = {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
    weekday: number
}

// Built once: creating an Intl.DateTimeFormat is the expensive part, and the
// slot math calls zonedParts() a few hundred times per request.
const PARTS_FORMAT = new Intl.DateTimeFormat("en-US", {
    timeZone: SALON_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
})

export function zonedParts(date: Date): ZonedParts {
    const values: Record<string, number> = {}
    for (const part of PARTS_FORMAT.formatToParts(date)) {
        if (part.type !== "literal") values[part.type] = Number(part.value)
    }
    const { year, month, day, minute, second } = values
    // Some engines still print midnight as "24" even with hourCycle h23.
    const hour = values.hour === 24 ? 0 : values.hour
    return { year, month, day, hour, minute, second, weekday: calendarWeekday(year, month, day) }
}

// How far the salon's clock is ahead of UTC at `instantMs`, in ms (negative
// in New York: −5 h in winter, −4 h in summer).
function offsetAt(instantMs: number): number {
    const p = zonedParts(new Date(instantMs))
    const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    return wallAsUtc - Math.floor(instantMs / 1000) * 1000
}

// The instant at which the salon's clock reads the given date and time.
// Out-of-range parts roll over the way Date.UTC does (day 32 → next month,
// hour 24 → next day), which the helpers below rely on.
//
// The offset is read at a first guess and then re-read at the corrected
// instant, which lands on the right side of a daylight-saving change. On the
// spring-forward night, a wall time that doesn't exist (2:30 AM) comes out an
// hour early; on the fall-back night, an ambiguous one (1:30 AM) resolves to
// the first of the two. The salon is closed at both times.
export function zonedToInstant(
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0,
    second = 0,
    ms = 0,
): Date {
    const wall = Date.UTC(year, month - 1, day, hour, minute, second, ms)
    const firstGuess = wall - offsetAt(wall)
    return new Date(wall - offsetAt(firstGuess))
}

// ---- Calendar dates with no time of day (pure arithmetic, no zone) ----

// 0 (Sunday) – 6 (Saturday) for a calendar date.
export function calendarWeekday(year: number, month: number, day: number): number {
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

// 28–31. month is 1–12.
export function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// "YYYY-MM-DD" for a calendar date. Rolls over like Date.UTC, so
// (2026, 13, 1) is "2027-01-01".
export function calendarDateKey(year: number, month: number, day: number): string {
    const date = new Date(Date.UTC(year, month - 1, day))
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, "0")
    const d = String(date.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

// "YYYY-MM-DD" → its parts, or null if it isn't a real date (month 13, Feb 30).
export function dateKeyParts(key: string): { year: number; month: number; day: number } | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
    if (!match) return null
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
    if (calendarDateKey(year, month, day) !== key) return null
    return { year, month, day }
}

// ---- Instants, read on the salon's clock ----

// 0 (Sunday) – 6 (Saturday): the salon's weekday at this instant.
export function salonWeekday(date: Date): number {
    return zonedParts(date).weekday
}

// Minutes since the salon's midnight (9:30 AM → 570). For placing things on
// the schedule grid and the "now" line.
export function salonMinutesOfDay(date: Date): number {
    const p = zonedParts(date)
    return p.hour * 60 + p.minute
}

// The salon's current year (the footer's copyright line).
export function salonYear(date: Date = new Date()): number {
    return zonedParts(date).year
}

// ---- Display ----
// Every date or time shown to anyone goes through one of these, so the
// server (UTC on Workers) and the browser (any zone) print the same thing,
// which also keeps server-rendered and hydrated HTML identical.

type DateLike = Date | string | number

export function formatSalonDate(date: DateLike, options: Intl.DateTimeFormatOptions): string {
    return new Date(date).toLocaleDateString("en-US", { ...options, timeZone: SALON_TIME_ZONE })
}

export function formatSalonTime(date: DateLike, options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }): string {
    return new Date(date).toLocaleTimeString("en-US", { ...options, timeZone: SALON_TIME_ZONE })
}

export function formatSalonDateTime(date: DateLike, options: Intl.DateTimeFormatOptions): string {
    return new Date(date).toLocaleString("en-US", { ...options, timeZone: SALON_TIME_ZONE })
}
