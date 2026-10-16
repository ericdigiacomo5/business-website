import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireUser } from "@/lib/require-user"
import { normalizeEmail, normalizePhone, requiredText, TEXT_LIMITS } from "@/lib/validation"
import { SAFE_USER_SELECT } from "@/lib/user-select"
import { readJsonObject } from "@/lib/request"

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

export async function PATCH(request: Request) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    // role/passwordHash are never read from the body at all — this endpoint
    // can never touch either, by construction, not just by choosing not to
    // read them.
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

    if (data.email !== undefined) {
        const existing = await prisma.user.findFirst({
            where: { email: data.email, NOT: { id: userId } },
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
            where: { id: userId },
            data,
            select: SAFE_USER_SELECT,
        })

        return Response.json({ data: updated }, { status: 200 })
    } catch (error) {
        // Race between the uniqueness check above and this update — another
        // request claimed the same email in between.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return Response.json(
                { error: "An account with that email already exists" },
                { status: 409 }
            )
        }
        throw error
    }
}
