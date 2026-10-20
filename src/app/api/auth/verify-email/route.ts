import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { hashResetToken } from "@/lib/password-reset-token"
import { readJsonObject } from "@/lib/request"
import { sendEmail } from "@/lib/email"
import { emailChangedEmail } from "@/lib/email-templates"

// One error for unknown, used and expired links — same reasoning as
// reset-password: telling them apart would reveal which tokens exist.
const INVALID_LINK_ERROR = { error: "This link is invalid or has expired." }

class LinkAlreadyUsedError extends Error {}

// Confirms an emailed link (see src/lib/email-verification.ts). Body:
// { token }. No sign-in required — the link may be opened on another
// device; the token itself is the proof. A POST from the /verify-email
// page's button, not a GET on the link, so mail scanners that pre-fetch
// links can't use it up.
//
// The token's address is either the account's current one (signup: mark it
// verified) or a new one (email change: switch to it, verified, and tell the
// old address).
export async function POST(request: Request) {
    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    if (typeof body.token !== "string" || !body.token) {
        return Response.json(INVALID_LINK_ERROR, { status: 400 })
    }

    const record = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: await hashResetToken(body.token) },
        include: { user: { select: { email: true } } },
    })
    if (!record || record.usedAt !== null || record.expiresAt.getTime() < Date.now()) {
        return Response.json(INVALID_LINK_ERROR, { status: 400 })
    }

    const previousEmail = record.user.email
    const isChange = record.email !== previousEmail
    const now = new Date()

    try {
        await prisma.$transaction(async (tx) => {
            // The claim: conditional on still unused, so a double click (or
            // two devices) can't apply it twice.
            const claimed = await tx.emailVerificationToken.updateMany({
                where: { id: record.id, usedAt: null },
                data: { usedAt: now },
            })
            if (claimed.count === 0) throw new LinkAlreadyUsedError()

            await tx.user.update({
                where: { id: record.userId },
                data: isChange ? { email: record.email, emailVerified: now } : { emailVerified: now },
            })

            // Any other outstanding link for this account is now stale.
            await tx.emailVerificationToken.deleteMany({
                where: { userId: record.userId, usedAt: null },
            })

            // Reset links were sent to the old address; after a change they
            // must not keep working from that inbox.
            if (isChange) {
                await tx.passwordResetToken.deleteMany({
                    where: { userId: record.userId, usedAt: null },
                })
            }
        })
    } catch (error) {
        if (error instanceof LinkAlreadyUsedError) {
            return Response.json(INVALID_LINK_ERROR, { status: 400 })
        }
        // Someone else took this address after the link was sent.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return Response.json(
                { error: "That email address is now used by another account." },
                { status: 409 }
            )
        }
        throw error
    }

    if (isChange) {
        after(() => sendEmail({ to: previousEmail, ...emailChangedEmail({ newEmail: record.email }) }))
    }

    return Response.json({ data: { email: record.email, changed: isChange } })
}
