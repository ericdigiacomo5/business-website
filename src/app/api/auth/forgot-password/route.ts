import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { isValidEmail } from "@/lib/validation"
import { generateResetToken } from "@/lib/password-reset-token"
import { sendEmail } from "@/lib/email"
import { passwordResetEmail } from "@/lib/email-templates"

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes
const RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds

// Always returns the same 200 + body, whether or not the email exists,
// belongs to a walk-in/OAuth-only account, or a token was already just
// issued. This is deliberate — see the branches below for why each case is
// silently absorbed rather than surfaced. Built once so every return site is
// byte-identical, not just worded the same.
const GENERIC_RESPONSE_BODY = {
    data: { message: "If an account exists for that email, we've sent a password reset link." },
}

export async function POST(request: Request) {
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (typeof body !== "object" || body === null) {
        return Response.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { email } = body as Record<string, unknown>

    if (!isValidEmail(email)) {
        return Response.json({ error: "A valid email is required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    // No account, or an account with no password (a walk-in created by an
    // admin, or a Google-only sign-up) — silently do nothing. Sending a
    // reset link to a passwordless account would let someone set a password
    // on it, and for the Google case would create a second credential path
    // onto an OAuth-only account. The identical response either way is what
    // keeps this from being an email-enumeration oracle.
    if (!user || !user.passwordHash) {
        return Response.json(GENERIC_RESPONSE_BODY)
    }

    // Per-email throttle: refuse a new token if an unused one was issued in
    // the last 60 seconds. Without this, the endpoint is a free
    // email-bombing relay pointed at any address — this needs no new
    // dependency, unlike a real per-IP rate limiter (FEATURE_GAPS.md #13).
    const recent = await prisma.passwordResetToken.findFirst({
        where: {
            userId: user.id,
            usedAt: null,
            createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
        },
    })
    if (recent) {
        return Response.json(GENERIC_RESPONSE_BODY)
    }

    const { token, tokenHash } = await generateResetToken()

    await prisma.passwordResetToken.create({
        data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
    })

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
    const { subject, html, text } = passwordResetEmail({ resetUrl })

    // Not awaited — after() schedules the send once the response has already
    // gone out, so response time never correlates with whether an account
    // existed. This is what closes the timing side-channel the identical
    // response text alone doesn't: a real send takes measurably longer than
    // the no-op branches above.
    after(() => sendEmail({ to: user.email, subject, html, text }))

    return Response.json(GENERIC_RESPONSE_BODY)
}
