// Shared across every route that accepts a user-supplied email/phone
// (register, admin/users create, profile edit) — extracted after this
// pattern started showing up a third time.

// Deliberately not RFC 5322-exhaustive — just enough to reject obvious
// garbage (no "@", no domain, whitespace). Proving the address is real and
// actually belongs to the registrant is a different problem, solved by
// send-a-confirmation-link verification (User.emailVerified already exists in
// the schema for this), not by stricter format matching here.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX_LENGTH = 254 // practical upper bound per RFC 5321

export function isValidEmail(email: unknown): email is string {
    return (
        typeof email === "string" &&
        email.length > 0 &&
        email.length <= EMAIL_MAX_LENGTH &&
        EMAIL_PATTERN.test(email)
    )
}

// No format validation beyond "non-empty" — phone formats vary too much
// (country codes, extensions, formatting) to regex meaningfully.
export function isValidPhone(phone: unknown): phone is string {
    return typeof phone === "string" && phone.length > 0
}
