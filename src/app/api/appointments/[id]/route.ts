import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/require-user";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const { id: appointmentId } = await params;

    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId }
    })

    if (!appointment) {
        return Response.json(
            { error: 'Appointment not found' },
            { status: 404 }
        )
    }

    // Ownership check — requireUser() only confirms *someone* is signed in;
    // without this, any authenticated user could cancel any other user's
    // appointment by id.
    if (appointment.userId !== userId) {
        return Response.json(
            { error: 'Forbidden' },
            { status: 403 }
        )
    }

    try {
        const cancelled = await prisma.$transaction(async (tx) => {
            // Cancelling is a soft update, not a real delete — the
            // Appointment row is kept as a historical record (status:
            // CANCELLED), matching Service's active-flag soft-delete. The
            // slots still need to be removed, though, or the grid stays
            // permanently blocked for a booking that no longer holds it.
            await tx.appointmentSlot.deleteMany({
                where: { appointmentId }
            })

            return tx.appointment.update({
                where: { id: appointmentId },
                data: { status: 'CANCELLED' }
            })
        })

        return Response.json({ data: cancelled })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: 'Appointment not found' },
                { status: 404 }
            )
        }

        throw error
    }
}
