import { prisma } from "@/lib/prisma";
import { Prisma, RecurringStatus } from "@/generated/prisma/client";
import type { RecurringAppointment } from "@/generated/prisma/client";
import { getOpenSlots, timeStringToDate } from "@/lib/availability";
import { generateOccurrenceDates, SKIP_REASON } from "@/lib/recurring";
import { toLocalDateKey } from "@/lib/format";
import { SERVICE_LINES_INCLUDE, servicesDurationMinutes } from "@/lib/appointment-services";

const SLOT_DURATION_MS = 15 * 60_000;

// The 15-minute AppointmentSlot starts a booking of this length occupies.
function slotStartsFor(startTime: Date, durationMinutes: number): Date[] {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    const slots: Date[] = [];
    for (let current = startTime; current < endTime; current = new Date(current.getTime() + SLOT_DURATION_MS)) {
        slots.push(current);
    }
    return slots;
}

// Pre-write availability check. The AppointmentSlot unique constraint is
// still the real guarantee — this just turns the common case into a clean
// "not available" instead of a P2002.
async function isFullyOpen(artistId: string, slots: Date[], allowPast: boolean): Promise<boolean> {
    const openSlots = await getOpenSlots(artistId, slots[0], { allowPast });
    const openSlotTimes = new Set(openSlots.map((slot) => slot.getTime()));
    return slots.every((slot) => openSlotTimes.has(slot.getTime()));
}

// A service to put on an appointment, with the price and duration to record
// for it — the Service's current values at the moment of booking.
export type ServiceToBook = { serviceId: string; priceCents: number; durationMinutes: number };

// Loads the given services in the order asked for, as lines ready to book.
// Returns null if any id doesn't exist. Shared by both booking routes and
// the admin "edit services" path so all three snapshot the same way.
export async function loadServicesToBook(serviceIds: string[]): Promise<ServiceToBook[] | null> {
    const rows = await prisma.service.findMany({ where: { id: { in: serviceIds } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    if (serviceIds.some((id) => !byId.has(id))) return null;

    return serviceIds.map((id) => {
        const service = byId.get(id)!;
        return { serviceId: id, priceCents: service.priceCents, durationMinutes: service.durationMinutes };
    });
}

// An appointment with its service lines — what the booking routes return.
export type BookedAppointment = Prisma.AppointmentGetPayload<{ include: typeof SERVICE_LINES_INCLUDE }>;

export type BookOccurrenceResult =
    | { ok: true; appointment: BookedAppointment }
    | { ok: false; error: string; status: number };

// Shared by POST /api/appointments (one-off booking) and materializeSeries()
// below (once per new occurrence of a standing appointment) — same
// availability check + Appointment/AppointmentSlot transaction either way.
export async function bookOccurrence(params: {
    userId: string;
    artistId: string;
    // One or more, in the order they should appear.
    services: ServiceToBook[];
    // Admin-only length override; defaults to the services' combined usual
    // length. Callers must take it from an admin session, never from a
    // customer's request.
    durationMinutes?: number;
    startTime: Date;
    recurringAppointmentId?: string;
    // "YYYY-MM-DD" week of the series this occurrence is for — its stable
    // identity, never changed by a reschedule. Only set for series
    // occurrences.
    occurrenceDate?: string;
    // Lets an admin caller book a slot whose startTime is already in the
    // past (e.g. entering a walk-in after the fact — see FEATURE_GAPS.md Gap
    // 3). Callers must derive this from the session's role themselves, never
    // from client input — this function has no way to verify it on its own.
    allowPast?: boolean;
}): Promise<BookOccurrenceResult> {
    const { userId, artistId, services, startTime, recurringAppointmentId, occurrenceDate, allowPast } = params;

    const durationMinutes = params.durationMinutes ?? servicesDurationMinutes(services);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    const slots = slotStartsFor(startTime, durationMinutes);

    if (!(await isFullyOpen(artistId, slots, allowPast ?? false))) {
        return { ok: false, error: "That time is not available", status: 400 };
    }

    try {
        const appointment = await prisma.$transaction(async (tx) => {
            const appointment = await tx.appointment.create({
                data: {
                    userId,
                    artistId,
                    startTime,
                    endTime,
                    recurringAppointmentId,
                    occurrenceDate,
                    services: {
                        create: services.map((service, position) => ({ ...service, position })),
                    },
                },
                include: SERVICE_LINES_INCLUDE,
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

export type MaterializeResult = {
    created: { appointmentId: string; occurrenceDate: string; startTime: Date }[];
    skipped: { occurrenceDate: string; startTime: Date; reason: string }[];
};

// Books every week of a just-created series, from seriesStart through its
// (mandatory) seriesEnd. Called once, by the creation route — nothing books
// or re-books a series' weeks afterward. A week whose time isn't available
// is recorded as a skip, so it stays visible on the series instead of
// silently missing.
export async function materializeSeries(
    seriesId: string,
    // allowPast: only for an admin caller backdating a series (Gap 3).
    options: { allowPast?: boolean } = {}
): Promise<MaterializeResult> {
    const series = await prisma.recurringAppointment.findUniqueOrThrow({
        where: { id: seriesId },
        include: {
            services: {
                orderBy: { position: "asc" },
                include: { service: { select: { priceCents: true, durationMinutes: true } } },
            },
        },
    });

    // Every visit is booked with the same services, at their current price
    // and duration — one snapshot for the whole series, taken now.
    const services: ServiceToBook[] = series.services.map((line) => ({
        serviceId: line.serviceId,
        priceCents: line.service.priceCents,
        durationMinutes: line.service.durationMinutes,
    }));

    const result: MaterializeResult = { created: [], skipped: [] };

    for (const date of generateOccurrenceDates(series.seriesStart, series.intervalWeeks, series.seriesEnd)) {
        const occurrenceDate = toLocalDateKey(date);
        const startTime = timeStringToDate(date, series.startTime);

        const booked = await bookOccurrence({
            userId: series.userId,
            artistId: series.artistId,
            services,
            startTime,
            recurringAppointmentId: seriesId,
            occurrenceDate,
            allowPast: options.allowPast ?? false,
        });

        if (booked.ok) {
            result.created.push({ appointmentId: booked.appointment.id, occurrenceDate, startTime });
        } else {
            const reason = SKIP_REASON.UNAVAILABLE;
            await prisma.recurringSkippedOccurrence.create({
                data: { recurringAppointmentId: seriesId, occurrenceDate, reason },
            });
            result.skipped.push({ occurrenceDate, startTime, reason });
        }
    }

    return result;
}

// Include fragment for a series' skipped weeks that are still ahead — past
// skips aren't actionable for anyone, so every series list (admin salon-wide,
// admin per-customer, customer) shows only these. A function, not a
// constant, because "today" has to be evaluated per request.
export function upcomingSkipsInclude() {
    return {
        skippedOccurrences: {
            where: { occurrenceDate: { gte: toLocalDateKey(new Date()) } },
            orderBy: { occurrenceDate: "asc" as const },
            select: { occurrenceDate: true, reason: true },
        },
    };
}

export type CancelSeriesResult = {
    recurringAppointment: RecurringAppointment;
    previousStatus: RecurringStatus;
    freedAppointmentIds: string[];
};

// The only thing that can be done to a standing appointment as a whole:
// cancel it. Marks the series CANCELLED and cancels its still-upcoming
// PENDING/CONFIRMED occurrences (freeing their slots) in one transaction.
// There is no pause and no editing — an individual occurrence is an ordinary
// Appointment and is rescheduled or cancelled through the normal appointment
// routes.
//
// Shared by the admin and customer PATCH routes, with `respectNoticeWindow`
// as the one behavioral difference between them. A non-admin cancelling a
// series should not be able to route around the same 24h notice window that
// already applies to cancelling one occurrence directly (see
// DELETE /api/appointments/[id]) — an admin has no such restriction, same
// asymmetry already established for admin vs. customer appointment routes
// throughout this project. Lives here, not in src/lib/recurring.ts, because
// that module is shared with Client Components and must stay free of
// server-only imports.
export async function cancelRecurringSeries(
    recurringAppointmentId: string,
    options: { respectNoticeWindow: boolean }
): Promise<CancelSeriesResult> {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
        // findUniqueOrThrow so a missing series still surfaces as P2025,
        // which the admin route already maps to 404.
        const previous = await tx.recurringAppointment.findUniqueOrThrow({
            where: { id: recurringAppointmentId },
            select: { status: true },
        });

        const recurringAppointment = await tx.recurringAppointment.update({
            where: { id: recurringAppointmentId },
            data: { status: RecurringStatus.CANCELLED },
        });

        const cutoff = options.respectNoticeWindow
            ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
            : now;

        const futureActive = await tx.appointment.findMany({
            where: {
                recurringAppointmentId,
                startTime: { gt: cutoff },
                status: { in: ["PENDING", "CONFIRMED"] },
            },
            select: { id: true },
        });
        const freedAppointmentIds = futureActive.map((a) => a.id);

        if (freedAppointmentIds.length > 0) {
            await tx.appointmentSlot.deleteMany({
                where: { appointmentId: { in: freedAppointmentIds } },
            });
            await tx.appointment.updateMany({
                where: { id: { in: freedAppointmentIds } },
                data: { status: "CANCELLED" },
            });
        }

        return { recurringAppointment, previousStatus: previous.status, freedAppointmentIds };
    });
}
