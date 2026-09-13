import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireAdmin } from "@/lib/require-admin"
import { isValidEmail, isValidPhone } from "@/lib/validation"
import { SAFE_USER_SELECT } from "@/lib/user-select"

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

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (typeof body !== "object" || body === null) {
        return Response.json({ error: "Invalid request body" }, { status: 400 })
    }

    // role/passwordHash are never destructured out of the body at all — this
    // endpoint cannot promote/demote a user or touch their credentials, by
    // construction. A separate, more deliberate route is the right place for
    // role changes if that's ever scoped in.
    const { name, email, phone } = body as Record<string, unknown>

    if (name !== undefined && (typeof name !== "string" || !name)) {
        return Response.json({ error: "Name is invalid" }, { status: 400 })
    }

    if (email !== undefined && !isValidEmail(email)) {
        return Response.json({ error: "A valid email is required" }, { status: 400 })
    }

    if (phone !== undefined && !isValidPhone(phone)) {
        return Response.json({ error: "A valid phone number is required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }

    if (email !== undefined) {
        const existing = await prisma.user.findFirst({
            where: { email: email as string, NOT: { id } },
        })
        if (existing) {
            return Response.json(
                { error: "An account with that email already exists" },
                { status: 409 }
            )
        }
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (phone !== undefined) data.phone = phone

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
