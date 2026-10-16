import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"
import { isServiceCategory } from "@/lib/service-category"
import { optionalText, requiredText, TEXT_LIMITS } from "@/lib/validation"
import { readJsonObject } from "@/lib/request"

export async function POST(request: Request) {
    const notAuthorized = await requireAdmin()
    if (notAuthorized) {
        return notAuthorized
    }

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const { category, durationMinutes, priceCents } = body

    const name = requiredText(body.name, TEXT_LIMITS.serviceName)
    if (name === null) {
        return Response.json({ error: "Name is required" }, { status: 400 })
    }

    const description = optionalText(body.description, TEXT_LIMITS.description)
    if (!description.ok) {
        return Response.json(
            { error: `Description must be text of at most ${TEXT_LIMITS.description} characters` },
            { status: 400 },
        )
    }

    if (!isServiceCategory(category)) {
        return Response.json({ error: "Category is required" }, { status: 400 })
    }

    if (durationMinutes === undefined || durationMinutes === null) {
        return Response.json({ error: "Duration is required" }, { status: 400 })
    }

    if (
        typeof durationMinutes !== "number" ||
        !Number.isInteger(durationMinutes) ||
        durationMinutes <= 0 ||
        durationMinutes % 15 !== 0
    ) {
        return Response.json(
            { error: "Duration must be a positive multiple of 15 minutes" },
            { status: 400 },
        )
    }

    // `=== undefined`, not `!priceCents` — a $0 service (e.g. a free
    // consultation) is valid, and `!0` is true.
    if (priceCents === undefined || priceCents === null) {
        return Response.json({ error: "Price is required" }, { status: 400 })
    }

    if (typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents < 0) {
        return Response.json(
            { error: "Price must be a non-negative whole number of cents" },
            { status: 400 },
        )
    }

    const service = await prisma.service.create({
        data: {
            name,
            description: description.value ?? null,
            category,
            durationMinutes,
            priceCents,
        },
    })

    return Response.json({ data: service }, { status: 201 })
}
