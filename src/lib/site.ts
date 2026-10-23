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
    // The number appointment texts come from (the Twilio number on the 10DLC
    // campaign), as dialled, e.g. "+16315550199". Shown in the terms' SMS
    // section once set.
    smsNumber: string | null
} = {
    // From the client's privacy policy (2026-10-22).
    address: "167 Park Avenue, Amityville, NY 11701",
    // From the client's terms of service (2026-10-22).
    phone: "+16316088009",
    email: null,
    instagramUrl: null,
    facebookUrl: null,
    reviewUrl: null,
    smsNumber: null,
}

// Each legal page's "Last updated" date, e.g. "October 22, 2026". Null while
// its text is still being written (the page then shows no date). Change it,
// in the same commit, whenever that page's wording changes.
export const PRIVACY_LAST_UPDATED: string | null = "October 22, 2026"
export const TERMS_LAST_UPDATED: string | null = "October 22, 2026"

// The contact named in the client's Termly-generated privacy policy and
// terms (2026-10-22), for privacy, legal, data-request and texting-support
// questions. Kept as the Yahoo address by choice (2026-10-22); a 10DLC
// reviewer may still ask for an address on the salon's own domain.
export const LEGAL_CONTACT = {
    email: "Libby.Bent@yahoo.com",
    phone: "+16316088009",
    postalLines: ["Nail Image Inc.", "167 Park Avenue", "Amityville, NY 11701", "United States"],
} as const

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
