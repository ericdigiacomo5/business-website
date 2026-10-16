// Shared across every place that hashes or validates a password (register,
// password reset, and auth.ts's timing-safe dummy hash) — extracted after
// this pair started getting copy-pasted a third time. A mismatch between
// these wouldn't break anything functionally, but would silently invalidate
// the timing-safety reasoning documented in auth.ts's DUMMY_PASSWORD_HASH.

// No composition rules (no forced uppercase/number/symbol) — current
// guidance (NIST 800-63B) recommends against them, since they tend to push
// people toward predictable patterns ("Password1!") rather than actually
// stronger passwords. A length floor is the higher-value, lower-friction check.
export const PASSWORD_MIN_LENGTH = 8

// bcrypt only uses the first 72 bytes of its input and silently ignores the
// rest, so two long passwords sharing their first 72 bytes would both work.
// Rejecting longer ones makes that limit explicit instead. Bytes, not
// characters: an emoji or accented letter is more than one byte in UTF-8.
export const PASSWORD_MAX_BYTES = 72

export const BCRYPT_COST = 10

// Why a new password isn't acceptable, or null if it is. Used by register
// and reset-password so both say the same thing.
export function passwordError(password: unknown): string | null {
    if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
        return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    }
    if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
        return `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes — about ${PASSWORD_MAX_BYTES} plain characters)`
    }
    return null
}
