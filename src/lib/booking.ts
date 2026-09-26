import { prisma } from "@/lib/prisma";
import { Prisma, RecurringStatus } from "@/generated/prisma/client";
import type { Appointment, RecurringAppointment } from "@/generated/prisma/client";
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

export type RecurringStatusChangeResult = {
    recurringAppointment: RecurringAppointment;
    freedAppointmentIds: string[];
};

// Shared by the admin and customer PATCH routes for pausing/resuming/
// cancelling a series (FEATURE_GAPS.md Gap 11) — same transaction either way,
// with `respectNoticeWindow` as the one behavioral difference between them.
// A non-admin cancelling/pausing a series should not be able to route around
// the same 24h notice window that already applies to cancelling one
// occurrence directly (see DELETE /api/appointments/[id]) — an admin has no
// such restriction, same asymmetry already established for admin vs.
// customer appointment routes throughout this project. Lives here, not in
// src/lib/recurring.ts, because that module is shared with Client Components
// (review-step.tsx imports MATERIALIZE_WEEKS) and must stay free of
// server-only imports — this file already is server-only, alongside
// bookOccurrence() above.
export async function applyRecurringStatusChange(
    recurringAppointmentId: string,
    status: RecurringStatus,
    options: { respectNoticeWindow: boolean }
): Promise<RecurringStatusChangeResult> {
    return prisma.$transaction(async (tx) => {
        const recurringAppointment = await tx.recurringAppointment.update({
            where: { id: recurringAppointmentId },
            data: { status },
        });

        let freedAppointmentIds: string[] = [];

        // PAUSED and CANCELLED both mean "stop honoring this series' future
        // commitment" from the schedule's point of view — the only
        // difference between them is whether the series can be turned back
        // on later, a distinction that matters to the series record, not to
        // its already-materialized occurrences. ACTIVE (resuming a PAUSED
        // series) intentionally does nothing here — see this function's
        // callers for why re-materialization is out of scope.
        if (status === RecurringStatus.PAUSED || status === RecurringStatus.CANCELLED) {
            const cutoff = options.respectNoticeWindow
                ? new Date(Date.now() + 24 * 60 * 60 * 1000)
                : new Date();

            const futureActive = await tx.appointment.findMany({
                where: {
                    recurringAppointmentId,
                    startTime: { gt: cutoff },
                    status: { in: ["UPCOMING", "CONFIRMED"] },
                },
                select: { id: true },
            });

            freedAppointmentIds = futureActive.map((a) => a.id);

            if (freedAppointmentIds.length > 0) {
                await tx.appointmentSlot.deleteMany({
                    where: { appointmentId: { in: freedAppointmentIds } },
                });
                await tx.appointment.updateMany({
                    where: { id: { in: freedAppointmentIds } },
                    data: { status: "CANCELLED" },
                });
            }
        }

        return { recurringAppointment, freedAppointmentIds };
    });
}
