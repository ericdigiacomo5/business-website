import { calendarDateKey, dateKeyParts, formatSalonDate, zonedParts, zonedToInstant } from "@/lib/salon-time"

export function formatPrice(cents: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

// 'YYYY-MM-DD' on the salon's calendar — not `date.toISOString()`, which is
// UTC-based and is the next day from 7 or 8 PM in New York.
export function toLocalDateKey(date: Date): string {
    const p = zonedParts(date)
    return calendarDateKey(p.year, p.month, p.day)
}

// 'HH:mm' on the salon's clock — the time-of-day component paired with a
// recurring rule's dayOfWeek, same convention as Availability/TimeOff.
export function toLocalTimeKey(date: Date): string {
    const p = zonedParts(date)
    return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`
}

// "09:00" → "9 AM", "17:30" → "5:30 PM" — for opening hours.
export function formatTimeOfDay(time: string): string {
    const [hours, minutes] = time.split(":").map(Number)
    const period = hours >= 12 ? "PM" : "AM"
    const hour = hours % 12 === 0 ? 12 : hours % 12
    return minutes === 0 ? `${hour} ${period}` : `${hour}:${String(minutes).padStart(2, "0")} ${period}`
}

// "Today 3:15 PM" / "Tomorrow 10 AM" / "Thu, Oct 23, 10 AM" — when the next
// opening is (artist cards, the booking strip). `now` for tests.
export function formatOpening(date: Date, now: Date = new Date()): string {
    const time = formatTimeOfDay(toLocalTimeKey(date))
    const today = zonedParts(now)
    if (toLocalDateKey(date) === calendarDateKey(today.year, today.month, today.day)) return `Today ${time}`
    if (toLocalDateKey(date) === calendarDateKey(today.year, today.month, today.day + 1)) return `Tomorrow ${time}`
    return `${formatSalonDate(date, { weekday: "short", month: "short", day: "numeric" })}, ${time}`
}

// Inverse of toLocalDateKey(): 'YYYY-MM-DD' → the instant of the salon's
// midnight that day. Never `new Date(dateString)`, which the JS spec parses
// as UTC midnight (the evening before, in New York). Returns null for
// anything malformed or not a real date (month 13, Feb 30). For an
// end-of-day bound, compose with endOfDay() from @/lib/schedule-grid.
export function parseLocalDate(value: string): Date | null {
    const parts = dateKeyParts(value)
    return parts ? zonedToInstant(parts.year, parts.month, parts.day) : null
}
