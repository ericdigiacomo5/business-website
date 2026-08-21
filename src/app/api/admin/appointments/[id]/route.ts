import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Prisma } from "@/generated/prisma/client";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const appointment = await prisma.appointment.findUnique({
        where: { id }
    })

    if (!appointment) {
        return Response.json(
            { error: "Appointment not found" },
            { status: 404 }
        )
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

    const { status } = body as Record<string, unknown>

    if (typeof status !== 'string' || !(Object.values(AppointmentStatus) as string[]).includes(status)) {
        return Response.json(
            { error: 'Status must be one of PENDING, CONFIRMED, CANCELLED, COMPLETED' },
            { status: 400 }
        )
    }

    try {
        const updated = await prisma.$transaction(async (tx) => {
            if (status === AppointmentStatus.CANCELLED) {
                // Same soft-cancel contract as DELETE /api/appointments/:id
                // — free the slots so the grid opens back up, keep the
                // Appointment row as a historical record.
                await tx.appointmentSlot.deleteMany({
                    where: { appointmentId: id }
                })
            }

            return tx.appointment.update({
                where: { id },
                data: { status: status as AppointmentStatus }
            })
        })

        return Response.json({ data: updated }, { status: 200 })
    } catch (error) {
        // Race between the findUnique above and this update — e.g. the row
        // was removed in between. Same pattern as admin/availability/[id].
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: 'Appointment not found' },
                { status: 404 }
            )
        }

        throw error
    }
}
