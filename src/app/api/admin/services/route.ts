import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(request: Request) {
    const notAuthorized = await requireAdmin()
    if (notAuthorized) {
        return notAuthorized
    }

    let body: unknown;
    try {
        body = await request.json()
    } catch {
        return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        )
    }

    if (typeof body !== 'object' || body === null) {
        return Response.json(
            { error: 'Invalid request body' },
            { status: 400 }
        )
    }

    const { name, description, durationMinutes, priceCents } = body as Record<string, unknown>

    if (!name || typeof name !== 'string') {
        return Response.json(
            { error: 'Name is required' },
            { status: 400 }
        )
    }

    if (description !== undefined && description !== null && typeof description !== 'string') {
        return Response.json(
            { error: 'Description is invalid' },
            { status: 400 }
        )
    }

    if (!durationMinutes || typeof durationMinutes !== 'number') {
        return Response.json(
            { error: "Duration is required" },
            { status: 400 }
        )
    }

    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes % 15 !== 0) {
        return Response.json(
            { error: "Duration must be a positive multiple of 15 minutes" },
            { status: 400 }
        )
    }

    if (!priceCents || typeof priceCents !== 'number') {
        return Response.json(
            { error: "Price is required" },
            { status: 400 }
        )
    }

    if (!Number.isInteger(priceCents) || priceCents < 0) {
        return Response.json(
            { error: "Price must be a non-negative whole number of cents" },
            { status: 400 }
        )
    }

    const service = await prisma.service.create({
        data: {
            name: name,
            description: description,
            durationMinutes: durationMinutes,
            priceCents: priceCents
        }
    })

    return Response.json(
        { data: service },
        { status: 201 }
    )
}