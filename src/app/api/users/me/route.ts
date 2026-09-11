import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireUser } from "@/lib/require-user"
import { isValidEmail, isValidPhone } from "@/lib/validation"

// Explicit select everywhere in this file, never a bare/include'd query —
// this is what guarantees passwordHash can never leak through this endpoint.
const SAFE_SELECT = { id: true, name: true, email: true, phone: true, role: true } as const

export async function GET() {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: SAFE_SELECT,
    })

    if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 })
    }

    return Response.json({ data: user })
}

export async function PATCH(request: Request) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

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
    // endpoint can never touch either, by construction, not just by choosing
    // not to read them.
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

    if (email !== undefined) {
        const existing = await prisma.user.findFirst({
            where: { email: email as string, NOT: { id: userId } },
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
            where: { id: userId },
            data,
            select: SAFE_SELECT,
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
