import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireUser } from "@/lib/require-user"
import { normalizeEmail, normalizePhone, personNameError, requiredPersonName } from "@/lib/validation"
import { SAFE_USER_SELECT } from "@/lib/user-select"
import { readJsonObject } from "@/lib/request"
import { issueEmailVerification } from "@/lib/email-verification"

export async function GET() {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: SAFE_USER_SELECT,
    })

    if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }

    return Response.json({ data: user })
}

// Body: { name?, email?, phone?, currentPassword? }. Name and phone change
// immediately. A new email does NOT: it changes the account's sign-in and
// recovery address, so with only a session that would turn a briefly
// stolen session into a permanent takeover (change the email, reset the
// password, and the reset signs the real owner out everywhere). Instead:
//   - the request must include currentPassword, and
//   - a confirmation link goes to the new address; User.email switches only
//     when it's used (POST /api/auth/verify-email), which also tells the old
//     address. The response's pendingEmail says a link was sent.
export async function PATCH(request: Request) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    // role/passwordHash are never read from the body at all — this endpoint
    // can never touch either, by construction, not just by choosing not to
    // read them. Email is never written here directly either (see above).
    const data: { name?: string; phone?: string } = {}

    if (body.name !== undefined) {
        const name = requiredPersonName(body.name)
        if (name === null) {
            return Response.json({ error: personNameError(body.name) }, { status: 400 })
        }
        data.name = name
    }

    let requestedEmail: string | null = null
    if (body.email !== undefined) {
        requestedEmail = normalizeEmail(body.email)
        if (requestedEmail === null) {
            return Response.json({ error: "A valid email is required" }, { status: 400 })
        }
    }

    if (body.phone !== undefined) {
        const phone = normalizePhone(body.phone)
        if (phone === null) {
            return Response.json({ error: "A valid phone number is required" }, { status: 400 })
        }
        data.phone = phone
    }

    const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, passwordHash: true },
    })
    if (!current) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }

    // Sending the address it already has is just the form re-submitting
    // every field — not a change.
    const newEmail = requestedEmail !== null && requestedEmail !== current.email ? requestedEmail : null

    if (newEmail !== null) {
        const password = body.currentPassword
        if (typeof password !== "string" || !password) {
            return Response.json(
                { error: "Enter your current password to change your email" },
                { status: 400 }
            )
        }
        // Every account that can sign in has a password (email and password
        // is the only sign-in method); one without can't change its email.
        if (current.passwordHash === null || !(await bcrypt.compare(password, current.passwordHash))) {
            return Response.json({ error: "That password isn't correct" }, { status: 403 })
        }

        const existing = await prisma.user.findFirst({
            where: { email: newEmail, NOT: { id: userId } },
            select: { id: true },
        })
        if (existing) {
            return Response.json(
                { error: "An account with that email already exists" },
                { status: 409 }
            )
        }
    }

    // The link goes first: it's the step that can be refused (one a minute),
    // and a refusal shouldn't leave the name/phone half-saved.
    if (newEmail !== null && !(await issueEmailVerification(userId, newEmail, "change"))) {
        return Response.json(
            { error: "We just sent you a link — please wait a minute before changing your email again." },
            { status: 429 }
        )
    }

    try {
        const updated = await prisma.user.update({
            where: { id: userId },
            data,
            select: SAFE_USER_SELECT,
        })

        // email is still the old address until the link is used.
        return Response.json({ data: { ...updated, pendingEmail: newEmail } }, { status: 200 })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return Response.json({ error: "User not found" }, { status: 404 })
        }
        throw error
    }
}
