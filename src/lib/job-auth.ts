// Guard for scheduled job routes (POST /api/jobs/*). A scheduler has no
// session, so these use a shared secret instead of requireUser()/
// requireAdmin(): `Authorization: Bearer $CRON_SECRET`. Same
// Response-or-null shape as requireAdmin().
export async function requireJobSecret(request: Request): Promise<Response | null> {
    const secret = process.env.CRON_SECRET

    // Fail closed, and loudly: an unset secret must never mean "anyone can
    // trigger this." 503 rather than 500 — the route is fine, it just isn't
    // configured, which is what a scheduler's logs should say.
    if (!secret) {
        return Response.json({ error: "Job route is not configured" }, { status: 503 })
    }

    const header = request.headers.get("authorization") ?? ""
    if (!(await secretsMatch(header, `Bearer ${secret}`))) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    return null
}

// Constant-time comparison so response timing can't be used to guess the
// secret one character at a time. Hashing both sides first gives two
// equal-length buffers to compare regardless of input length. Web Crypto,
// not Node's `crypto` module, so it runs unchanged on Cloudflare Workers —
// same reasoning as src/lib/password-reset-token.ts.
async function secretsMatch(a: string, b: string): Promise<boolean> {
    const encoder = new TextEncoder()
    const [hashA, hashB] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(a)),
        crypto.subtle.digest("SHA-256", encoder.encode(b)),
    ])
    const bytesA = new Uint8Array(hashA)
    const bytesB = new Uint8Array(hashB)

    let diff = 0
    for (let i = 0; i < bytesA.length; i++) {
        diff |= bytesA[i] ^ bytesB[i]
    }
    return diff === 0
}
