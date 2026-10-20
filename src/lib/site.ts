export const SITE_NAME = "Nail Image Inc."
export const SITE_TAGLINE = "Hand & gel nail care, booked in a minute"

// The salon's public contact details, shown in the footer, on the booking
// confirmation and in emails. Every field is optional: anything left null is
// simply not shown, so nothing invented ever reaches a customer. Fill these
// in with the client's real details (FEATURE_GAPS.md Gap 14) — opening hours
// aren't here, they come from the artists' weekly availability
// (getSalonHours() in src/lib/salon-hours.ts).
export const SALON_CONTACT: {
    // One line, e.g. "123 Merrick Rd, Amityville, NY 11701".
    address: string | null
    // As it should be dialled, e.g. "+16315550100"; shown formatted.
    phone: string | null
    email: string | null
    instagramUrl: string | null
    facebookUrl: string | null
    // The salon's Google review link ("Leave us a review" in the receipt).
    reviewUrl: string | null
} = {
    address: null,
    phone: null,
    email: null,
    instagramUrl: null,
    facebookUrl: null,
    reviewUrl: null,
}

// A Google Maps search link for the address — no API key, no embed (the CSP
// would need to allow Google's frames for an embed).
export function mapUrl(address: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

// "+16315550100" → "(631) 555-0100"; anything else is shown as given.
export function formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "")
    return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : phone
}
