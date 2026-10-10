import { sendDueReminders } from "@/lib/appointment-emails"

// Sends the 24h reminder email for every appointment that's due one. Meant to
// be hit on a schedule (hourly is plenty — a reminder then lands 23–24h
// ahead) by whatever scheduler the deploy ends up with: a Cloudflare Workers
// Cron Trigger, a GitHub Actions cron, or a third-party cron pinger. A plain
// guarded route rather than a Workers `scheduled()` handler on purpose — how
// a scheduled handler attaches to a Next.js deploy depends on the still-open
// vinext-vs-OpenNext adapter question (PROJECT_STATUS.md item 8), and this
// shouldn't be blocked on that.
//
// Not a user-facing route, so not requireUser()/requireAdmin(): a scheduler
// has no session. Guarded by a shared secret in the Authorization header
// instead (`Authorization: Bearer $CRON_SECRET`). Safe to call repeatedly or
// concurrently — see sendDueReminders() for how double-sends are prevented.
export async function POST(request: Request) {
    const secret = process.env.CRON_SECRET

    // Fail closed: an unset secret must never mean "anyone can trigger this."
    if (!secret) {
        return Response.json({ error: "Job route is not configured" }, { status: 500 })
    }

    const header = request.headers.get("authorization") ?? ""
    if (!(await secretsMatch(header, `Bearer ${secret}`))) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await sendDueReminders()
    return Response.json({ data: result })
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
