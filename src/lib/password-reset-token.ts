// Web Crypto (crypto.getRandomValues / crypto.subtle), not Node's `crypto`
// module — both are globally available in this Next.js runtime already, and
// staying off Node-only APIs matters here specifically because this project's
// eventual Cloudflare Workers deploy has an unresolved adapter question
// (PROJECT_STATUS.md item 8); no reason to add a second uncertain dependency
// to a route that doesn't need one.

function toHex(bytes: ArrayBuffer | Uint8Array): string {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")
}

async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
    return toHex(digest)
}

// 32 random bytes (256 bits) — well above OWASP's minimum entropy guidance
// for a reset token. Returns both the plaintext (only ever seen by the
// emailed link, never persisted) and its hash (what actually gets stored and
// looked up) — storing the plaintext would mean a database leak hands over
// live account takeover, the same reasoning that keeps User.passwordHash
// hashed rather than plain.
export async function generateResetToken(): Promise<{ token: string; tokenHash: string }> {
    const token = toHex(crypto.getRandomValues(new Uint8Array(32)))
    const tokenHash = await sha256Hex(token)
    return { token, tokenHash }
}

// Exposed separately so the verify/submit route can hash an incoming token
// and look it up by tokenHash, without duplicating the hashing logic.
export async function hashResetToken(token: string): Promise<string> {
    return sha256Hex(token)
}
