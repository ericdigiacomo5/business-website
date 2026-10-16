// Shared input validation for every route that accepts user-supplied text.
// Plain module with no imports, so Client Components can use it too.

// Deliberately not RFC 5322-exhaustive — just enough to reject obvious
// garbage (no "@", no domain, whitespace). Proving the address is real and
// actually belongs to the registrant is a different problem, solved by
// send-a-confirmation-link verification (User.emailVerified already exists in
// the schema for this), not by stricter format matching here.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX_LENGTH = 254 // practical upper bound per RFC 5321

// Upper bounds for free-text fields. Generous for real use; they exist so a
// single request can't store megabytes in a name or bio.
export const TEXT_LIMITS = {
    personName: 100,
    phone: 30,
    artistName: 100,
    bio: 2000,
    serviceName: 100,
    description: 1000,
    caption: 300,
} as const

// Emails are stored and looked up in one canonical form — trimmed and
// lowercased — so "Jane@X.com " and "jane@x.com" are the same account
// everywhere (register, sign-in, password reset, profile and admin edits).
// Returns the normalized address, or null if it isn't a valid email.
export function normalizeEmail(value: unknown): string | null {
    if (typeof value !== "string") return null
    const email = value.trim().toLowerCase()
    if (email.length === 0 || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
        return null
    }
    return email
}

// Required single-line text: trimmed, non-empty, at most maxLength
// characters. Returns the trimmed string, or null if invalid (so a name of
// "   " is rejected rather than stored as blank).
export function requiredText(value: unknown, maxLength: number): string | null {
    if (typeof value !== "string") return null
    const text = value.trim()
    return text.length > 0 && text.length <= maxLength ? text : null
}

// Optional text for a nullable column, following this project's PATCH
// convention: undefined = not sent, null = clear it. Anything else must be a
// string of at most maxLength characters after trimming; an empty string is
// stored as null. Returns { ok: false } when the value is invalid.
export function optionalText(
    value: unknown,
    maxLength: number
): { ok: true; value: string | null | undefined } | { ok: false } {
    if (value === undefined) return { ok: true, value: undefined }
    if (value === null) return { ok: true, value: null }
    if (typeof value !== "string") return { ok: false }
    const text = value.trim()
    if (text.length > maxLength) return { ok: false }
    return { ok: true, value: text.length > 0 ? text : null }
}

// No format validation beyond length — phone formats vary too much (country
// codes, extensions, formatting) to regex meaningfully. Returns the trimmed
// number, or null if invalid.
export function normalizePhone(value: unknown): string | null {
    return requiredText(value, TEXT_LIMITS.phone)
}

// Placeholder phone stored for accounts created without one (Google sign-up,
// and rows that predate the phone column). Treated as "missing" everywhere.
export const UNKNOWN_PHONE = "UNKNOWN"

// Returned by the booking routes when a customer without a name or real
// phone number tries to book (see Session.user.profileIncomplete). Shared so
// the booking review step can show the same wording.
export const PROFILE_INCOMPLETE_MESSAGE =
    "Please add your name and phone number to your profile before booking, so the salon can reach you."

// Artist photos and portfolio images must be Cloudinary delivery URLs —
// they're only ever produced by the signed upload flow (see
// /api/admin/uploads/sign). Pass the account's cloud name (server-side) to
// also reject images from someone else's Cloudinary account. Anything else
// (javascript:, data:, other hosts, garbage) is refused, which is also what
// lets the CSP's img-src and next/image's remotePatterns name one host.
export function isCloudinaryUrl(value: unknown, cloudName?: string): value is string {
    if (typeof value !== "string") return false
    try {
        const url = new URL(value)
        if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return false
        return cloudName ? url.pathname.startsWith(`/${cloudName}/`) : true
    } catch {
        return false
    }
}

// Constrains a post-sign-in redirect target to a same-origin relative path.
//
// Without this, /login?callbackUrl=https://evil.example sends the user to an
// attacker's site immediately after a genuine sign-in on the real domain —
// which is exactly what makes a fake "session expired, sign in again" page
// convincing. signIn() is called with redirect:false and the app navigates
// itself, so Auth.js's own callback-URL origin check never runs; validating
// here is what replaces it.
//
// Rejects absolute URLs, and both "//evil.example" and "/\evil.example",
// which browsers normalize into protocol-relative external URLs despite
// starting with a slash.
export function safeCallbackUrl(raw: unknown): string {
    if (typeof raw !== "string" || !raw.startsWith("/")) return "/"
    if (raw.startsWith("//") || raw.startsWith("/\\")) return "/"
    return raw
}
