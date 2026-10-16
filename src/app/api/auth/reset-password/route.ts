import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { hashResetToken } from "@/lib/password-reset-token"
import { BCRYPT_COST, passwordError } from "@/lib/password"
import { readJsonObject } from "@/lib/request"

// One identical error for "not found," "already used," and "expired" — and
// also for a malformed/missing token in the request itself. Distinguishing
// any of these would tell an attacker which tokens exist or existed.
const INVALID_TOKEN_ERROR = { error: "This link is invalid or has expired." }

export async function POST(request: Request) {
    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const { token, password } = body

    if (typeof token !== "string" || !token) {
        return Response.json(INVALID_TOKEN_ERROR, { status: 400 })
    }

    const passwordProblem = passwordError(password)
    if (passwordProblem || typeof password !== "string") {
        return Response.json({ error: passwordProblem }, { status: 400 })
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
