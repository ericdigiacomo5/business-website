import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireAdmin } from "@/lib/require-admin"
import { normalizeEmail, normalizePhone, requiredText, TEXT_LIMITS } from "@/lib/validation"
import { SAFE_USER_SELECT } from "@/lib/user-select"
import { readJsonObject } from "@/lib/request"

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
        const name = requiredText(body.name, TEXT_LIMITS.personName)
        if (name === null) {
            return Response.json(
                { error: `Name is required (up to ${TEXT_LIMITS.personName} characters)` },
                { status: 400 }
            )
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

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }

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
        const updated = await prisma.user.update({
            where: { id: user.id },
            data,
            select: SAFE_USER_SELECT,
        })

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
