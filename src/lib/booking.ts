import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { Appointment } from "@/generated/prisma/client";
import { getOpenSlots } from "@/lib/availability";

const SLOT_DURATION_MS = 15 * 60_000;

export type BookOccurrenceResult =
    | { ok: true; appointment: Appointment }
    | { ok: false; error: string; status: number };

// Shared by POST /api/appointments (one-off booking) and the recurring
// booking route (which calls this once per materialized occurrence) — same
// availability check + Appointment/AppointmentSlot transaction either way.
export async function bookOccurrence(params: {
    userId: string;
    artistId: string;
    serviceId: string;
    serviceDurationMinutes: number;
    startTime: Date;
    recurringAppointmentId?: string;
    // Lets an admin caller book a slot whose startTime is already in the
    // past (e.g. entering a walk-in after the fact — see FEATURE_GAPS.md Gap
    // 3). Callers must derive this from the session's role themselves, never
    // from client input — this function has no way to verify it on its own.
    allowPast?: boolean;
}): Promise<BookOccurrenceResult> {
    const { userId, artistId, serviceId, serviceDurationMinutes, startTime, recurringAppointmentId, allowPast } = params;

    const endTime = new Date(startTime.getTime() + serviceDurationMinutes * 60_000);

    const slots: Date[] = [];
    let current = startTime;
    while (current < endTime) {
        slots.push(current);
        current = new Date(current.getTime() + SLOT_DURATION_MS);
    }

    const openSlots = await getOpenSlots(artistId, startTime, { allowPast });
    const openSlotTimes = new Set(openSlots.map((slot) => slot.getTime()));
    const isFullyAvailable = slots.every((slot) => openSlotTimes.has(slot.getTime()));

    if (!isFullyAvailable) {
        return { ok: false, error: "That time is not available", status: 400 };
    }

    try {
        const appointment = await prisma.$transaction(async (tx) => {
            const appointment = await tx.appointment.create({
                data: {
                    userId,
                    artistId,
                    serviceId,
                    startTime,
                    endTime,
                    recurringAppointmentId,
                },
            });

            await tx.appointmentSlot.createMany({
                data: slots.map((slotStart) => ({
                    artistId,
                    slotStart,
                    appointmentId: appointment.id,
                })),
            });

            return appointment;
        });

        return { ok: true, appointment };
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return { ok: false, error: "That time was just booked, please pick another", status: 409 };
        }

        throw error;
    }
}
