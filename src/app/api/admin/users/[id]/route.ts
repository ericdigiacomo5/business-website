import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireAdmin } from "@/lib/require-admin"
import { normalizeEmail, normalizePhone, personNameError, requiredPersonName } from "@/lib/validation"
import { SAFE_USER_SELECT } from "@/lib/user-select"
import { readJsonObject } from "@/lib/request"
import { sendEmail } from "@/lib/email"
import { emailChangedEmail } from "@/lib/email-templates"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const user = await prisma.user.findUnique({
        where: { id },
        select: SAFE_USER_SELECT,
    })

    if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }

    return Response.json({ data: user })
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    // role/passwordHash are never read from the body at all — this endpoint
    // cannot promote/demote a user or touch their credentials, by
    // construction. A separate, more deliberate route is the right place for
    // role changes if that's ever scoped in.
    const data: { name?: string; email?: string; phone?: string } = {}

    if (body.name !== undefined) {
        const name = requiredPersonName(body.name)
        if (name === null) {
            return Response.json({ error: personNameError(body.name) }, { status: 400 })
        }
        data.name = name
    }

    if (body.email !== undefined) {
        const email = normalizeEmail(body.email)
        if (email === null) {
            return Response.json({ error: "A valid email is required" }, { status: 400 })
        }
        data.email = email
    }

    if (body.phone !== undefined) {
        const phone = normalizePhone(body.phone)
        if (phone === null) {
            return Response.json({ error: "A valid phone number is required" }, { status: 400 })
        }
        data.phone = phone
    }

    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, passwordHash: true },
    })
    if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }
    const emailChanging = data.email !== undefined && data.email !== user.email

    if (data.email !== undefined) {
        const existing = await prisma.user.findFirst({
            where: { email: data.email, NOT: { id } },
        })
        if (existing) {
            return Response.json(
                { error: "An account with that email already exists" },
                { status: 409 }
            )
        }
    }

    try {
        // An admin is trusted to set a customer's address (they're usually
        // fixing it with the customer at the desk), so it changes right
        // away. But any reset or verification link already sent went to the
        // old address and must stop working, and an account that can sign
        // in gets a notice at the old address so a change it didn't ask for
        // doesn't go unnoticed.
        const updated = await prisma.$transaction(async (tx) => {
            if (emailChanging) {
                await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })
                await tx.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } })
            }
            return tx.user.update({
                where: { id: user.id },
                data,
                select: SAFE_USER_SELECT,
            })
        })

        // No password = a walk-in, which can't sign in; nobody to warn.
        const canSignIn = user.passwordHash !== null
        if (emailChanging && canSignIn) {
            const previousEmail = user.email
            after(() => sendEmail({ to: previousEmail, ...emailChangedEmail({ newEmail: updated.email }) }))
        }

        return Response.json({ data: updated }, { status: 200 })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return Response.json({ error: "User not found" }, { status: 404 })
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return Response.json(
                { error: "An account with that email already exists" },
                { status: 409 }
            )
        }
        throw error
    }
}
