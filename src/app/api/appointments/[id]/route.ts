import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {

    const { id: appointmentId } = await params;

    try {
        await prisma.$transaction(async (tx) => {
            await tx.appointmentSlot.deleteMany({
                where: { appointmentId }
            })

            await tx.appointment.delete({
                where: { id: appointmentId }
            })
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: 'Appointment not found' },
                { status: 404 }
            )
        }

        throw error
    }

    return Response.json({ success: true })
}
