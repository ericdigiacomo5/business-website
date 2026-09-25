import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireUser } from "@/lib/require-user"

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const { id: appointmentId } = await params

    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
    })

    if (!appointment) {
        return Response.json({ error: "Appointment not found" }, { status: 404 })
    }

    // Ownership check — requireUser() only confirms *someone* is signed in;
    // without this, any authenticated user could cancel any other user's
    // appointment by id.
    if (appointment.userId !== userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    // A CANCELLED/COMPLETED appointment has nothing left to cancel — without
    // this, a far-future (>24h out) appointment already in a terminal state
    // would fall through the notice-window check below (its startTime isn't
    // "soon") and hit the transaction again. Checked before the notice
    // window since it's the more fundamental gate: timing is irrelevant to
    // an appointment that can't be cancelled at all regardless of when it
    // starts.
    if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
        return Response.json(
            { error: "This appointment can no longer be cancelled" },
            { status: 400 },
        )
    }

    // This route only ever cancels the caller's own appointment (see the
    // ownership check above) — an admin acting on someone else's behalf
    // goes through PATCH /api/admin/appointments/[id] instead, which has no
    // notice-window restriction. So no admin branch is needed here.
    const cancellationWindow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    if (appointment.startTime < cancellationWindow) {
        return Response.json(
            { error: "Cannot cancel less than 24 hours in advance" },
            { status: 400 },
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
                where: { appointmentId },
            })

            return tx.appointment.update({
                where: { id: appointmentId },
                data: { status: "CANCELLED" },
            })
        })

        return Response.json({ data: cancelled })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return Response.json({ error: "Appointment not found" }, { status: 404 })
        }

        throw error
    }
}
