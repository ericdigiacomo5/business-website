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

export const BCRYPT_COST = 10
