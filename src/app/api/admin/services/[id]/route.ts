import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireAdmin } from "@/lib/require-admin"
import { isServiceCategory } from "@/lib/service-category"
import { optionalText, requiredText, TEXT_LIMITS } from "@/lib/validation"
import { readJsonObject, rejectCrossOrigin } from "@/lib/request"
import { isFeeCents, MAX_SERVICE_FEE_CENTS } from "@/lib/pay-report"
import { formatPrice } from "@/lib/format"
import { SERVICE_PAY_TERMS_INCLUDE, setServiceFee } from "@/lib/pay-terms"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const { category, durationMinutes, priceCents, active, serviceFeeCents } = body

    let name: string | undefined
    if (body.name !== undefined) {
        const parsed = requiredText(body.name, TEXT_LIMITS.serviceName)
        if (parsed === null) {
            return Response.json({ error: "Name is invalid" }, { status: 400 })
        }
        name = parsed
    }

    // undefined = don't touch, null or "" = clear it.
    const description = optionalText(body.description, TEXT_LIMITS.description)
    if (!description.ok) {
        return Response.json(
            { error: `Description must be text of at most ${TEXT_LIMITS.description} characters` },
            { status: 400 },
        )
    }

    // No null case, unlike description: category is a required column, so
    // there's nothing to "clear" it to.
    if (category !== undefined && !isServiceCategory(category)) {
        return Response.json({ error: "Category is invalid" }, { status: 400 })
    }

    if (
        durationMinutes !== undefined &&
        (typeof durationMinutes !== "number" ||
            !Number.isInteger(durationMinutes) ||
            durationMinutes <= 0 ||
            durationMinutes % 15 !== 0)
    ) {
        return Response.json(
            { error: "Duration must be a positive multiple of 15 minutes" },
            { status: 400 },
        )
    }

    if (
        priceCents !== undefined &&
        (typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents < 0)
    ) {
        return Response.json(
            { error: "Price must be a non-negative whole number of cents" },
            { status: 400 },
        )
    }

    // Lets an admin reactivate a service that was soft-deleted via DELETE
    // /api/admin/services/:id, or deactivate one without going through
    // DELETE at all.
    if (active !== undefined && typeof active !== "boolean") {
        return Response.json({ error: "Active must be a boolean" }, { status: 400 })
    }

    // Fee charged to the artist per service performed; 0 removes it. Only
    // visits checked out from now on use the new fee.
    if (serviceFeeCents !== undefined && !isFeeCents(serviceFeeCents)) {
        return Response.json(
            { error: `Service fee must be from $0 to ${formatPrice(MAX_SERVICE_FEE_CENTS)}` },
            { status: 400 },
        )
    }

    const service = await prisma.service.findUnique({
        where: { id: id },
    })

    if (!service) {
        return Response.json({ error: "Service not found" }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (description.value !== undefined) data.description = description.value
    if (category !== undefined) data.category = category
    if (durationMinutes !== undefined) data.durationMinutes = durationMinutes
    if (priceCents !== undefined) data.priceCents = priceCents
    if (active !== undefined) data.active = active

    try {
        const updatedService = await prisma.$transaction(async (tx) => {
            await tx.service.update({
                where: { id: service.id },
                data,
            })
            if (serviceFeeCents !== undefined) {
                await setServiceFee(tx, service.id, serviceFeeCents as number)
            }
            return tx.service.findUniqueOrThrow({ where: { id: service.id }, include: SERVICE_PAY_TERMS_INCLUDE })
        })

        return Response.json({ data: updatedService }, { status: 200 })
    } catch (error) {
        // Race between the findUnique above and this update — e.g. the row
        // was removed in between. Narrow, but a real possibility for any
        // check-then-act pattern, and worth a clean 404 instead of a raw 500.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return Response.json({ error: "Service not found" }, { status: 404 })
        }

        throw error
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const crossOrigin = rejectCrossOrigin(request)
    if (crossOrigin) return crossOrigin

    const { id } = await params

    const service = await prisma.service.findUnique({
        where: { id },
    })

    if (!service) {
        return Response.json({ error: "Service not found" }, { status: 404 })
    }

    // Soft delete, not a real row deletion: Appointment.serviceId is a
    // RESTRICT foreign key, so hard-deleting a service that's ever been
    // booked (even once, even for a cancelled/completed appointment) would
    // fail outright — and even if it didn't, physically deleting a service
    // would mean losing the ability to show historical bookings what they
    // were actually for. Setting active: false hides it from GET
    // /api/services going forward without touching any of that history.
    try {
        const deactivatedService = await prisma.service.update({
            where: { id },
            data: { active: false },
        })

        return Response.json({ data: deactivatedService }, { status: 200 })
    } catch (error) {
        // Same race as PATCH's — the row disappeared between findUnique and
        // this update.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return Response.json({ error: "Service not found" }, { status: 404 })
        }

        throw error
    }
}
