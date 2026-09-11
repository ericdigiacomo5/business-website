import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { NextRequest } from "next/server";

// Deliberately not RFC 5322-exhaustive — same pragmatic check as
// src/app/api/auth/register/route.ts, just enough to reject obvious garbage.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX_LENGTH = 254

export async function GET(request: NextRequest) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const q = request.nextUrl.searchParams.get("q")?.trim()

    const users = await prisma.user.findMany({
        where: q
            ? {
                OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                    { phone: { contains: q, mode: "insensitive" } },
                ],
            }
            : undefined,
        // Explicit select, never a bare/include'd query — this is what
        // guarantees passwordHash can never leak through this endpoint.
        select: { id: true, name: true, email: true, phone: true, role: true },
        orderBy: { createdAt: "desc" },
        take: 20,
    })

    return Response.json({ data: users })
}

export async function POST(request: Request) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    let body: unknown;
    try {
        body = await request.json()
    } catch {
        return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        )
    }

    if (typeof body !== "object" || body === null) {
        return Response.json(
            { error: "Invalid request body" },
            { status: 400 }
        )
    }

    const { name, email, phone } = body as Record<string, unknown>

    if (!name || typeof name !== "string") {
        return Response.json(
            { error: "Name is required" },
            { status: 400 }
        )
    }

    if (
        !email ||
        typeof email !== "string" ||
        email.length > EMAIL_MAX_LENGTH ||
        !EMAIL_PATTERN.test(email)
    ) {
        return Response.json(
            { error: "A valid email is required" },
            { status: 400 }
        )
    }

    // No format validation beyond "non-empty" — phone formats vary too much
    // to regex meaningfully, same reasoning as the registration route.
    if (!phone || typeof phone !== "string") {
        return Response.json(
            { error: "A phone number is required" },
            { status: 400 }
        )
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
        return Response.json(
            { error: "A customer with that email already exists" },
            { status: 409 }
        )
    }

    // No password — admin-created walk-in customers are booking records
    // only and cannot sign in. Do not generate one. role is hardcoded, never
    // read from the body — this endpoint cannot mint admins.
    const user = await prisma.user.create({
        data: { name, email, phone, passwordHash: null, role: "CUSTOMER" },
        select: { id: true, name: true, email: true, phone: true, role: true },
    })

    return Response.json({ data: user }, { status: 201 })
}
