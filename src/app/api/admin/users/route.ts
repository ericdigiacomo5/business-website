import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { normalizeEmail, normalizePhone, personNameError, requiredPersonName } from "@/lib/validation";
import { SAFE_USER_SELECT } from "@/lib/user-select";
import { readJsonObject } from "@/lib/request";
import { NextRequest } from "next/server";
import { AppointmentStatus } from "@/generated/prisma/client";

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
        // Plus each customer's no-show count, for the booking sheet's
        // repeat no-show flag (FEATURE_GAPS.md Gap 28).
        select: {
            ...SAFE_USER_SELECT,
            _count: { select: { appointments: { where: { status: AppointmentStatus.NO_SHOW } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
    })

    return Response.json({
        data: users.map(({ _count, ...user }) => ({ ...user, noShowCount: _count.appointments })),
    })
}

export async function POST(request: Request) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const name = requiredPersonName(body.name)
    if (name === null) {
        return Response.json(
            { error: personNameError(body.name) },
            { status: 400 }
        )
    }

    const email = normalizeEmail(body.email)
    if (email === null) {
        return Response.json(
            { error: "A valid email is required" },
            { status: 400 }
        )
    }

    const phone = normalizePhone(body.phone)
    if (phone === null) {
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
        select: SAFE_USER_SELECT,
    })

    return Response.json({ data: user }, { status: 201 })
}
