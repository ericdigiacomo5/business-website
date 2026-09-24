import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { hashResetToken } from "@/lib/password-reset-token"
import { PASSWORD_MIN_LENGTH, BCRYPT_COST } from "@/lib/password"

// One identical error for "not found," "already used," and "expired" — and
// also for a malformed/missing token in the request itself. Distinguishing
// any of these would tell an attacker which tokens exist or existed.
const INVALID_TOKEN_ERROR = { error: "This link is invalid or has expired." }

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

    const { token, password } = body as Record<string, unknown>

    if (typeof token !== "string" || !token) {
        return Response.json(INVALID_TOKEN_ERROR, { status: 400 })
    }

    if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
        return Response.json(
            { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
            { status: 400 }
        )
    }

    const tokenHash = await hashResetToken(token)

    const resetToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
    })

    if (
        !resetToken ||
        resetToken.usedAt !== null ||
        resetToken.expiresAt.getTime() < Date.now()
    ) {
        return Response.json(INVALID_TOKEN_ERROR, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
    const now = new Date()

    // Single transaction: the password update, marking this token used, and
    // clearing any other outstanding tokens for this user all have to land
    // together — a partial write here would leave either a usable second
    // link, or a password that appears changed while passwordChangedAt (and
    // therefore session invalidation, see auth.ts) silently didn't happen.
    await prisma.$transaction([
        prisma.user.update({
            where: { id: resetToken.userId },
            data: { passwordHash, passwordChangedAt: now },
        }),
        prisma.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { usedAt: now },
        }),
        prisma.passwordResetToken.deleteMany({
            where: {
                userId: resetToken.userId,
                id: { not: resetToken.id },
                usedAt: null,
            },
        }),
    ])

    return Response.json({ data: { message: "Password updated." } })
}
