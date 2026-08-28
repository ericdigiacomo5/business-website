export function formatPrice(cents: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

// 'YYYY-MM-DD' in local time — not `date.toISOString()`, which is UTC-based
// and can shift to the wrong calendar day near midnight. Matches the
// local-time convention used throughout the backend (see PROJECT_STATUS.md).
export function toLocalDateKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

// 'HH:mm' in local time — the time-of-day component paired with a recurring
// rule's dayOfWeek, same convention as Availability/TimeOff.
export function toLocalTimeKey(date: Date): string {
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    return `${hours}:${minutes}`
}
