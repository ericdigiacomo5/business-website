import { prisma } from "@/lib/prisma";
import { Prisma, RecurringStatus } from "@/generated/prisma/client";
import type { Appointment, RecurringAppointment } from "@/generated/prisma/client";
import { getOpenSlots, startOfDay, timeStringToDate } from "@/lib/availability";
import { addDays, generateOccurrenceDates, materializationHorizon, SKIP_REASON } from "@/lib/recurring";
import { toLocalDateKey } from "@/lib/format";

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

// Pre-write availability check shared by booking and reactivation. The
// AppointmentSlot unique constraint is still the real guarantee — this just
// turns the common case into a clean "not available" instead of a P2002.
async function isFullyOpen(artistId: string, slots: Date[], allowPast: boolean): Promise<boolean> {
    const openSlots = await getOpenSlots(artistId, slots[0], { allowPast });
    const openSlotTimes = new Set(openSlots.map((slot) => slot.getTime()));
    return slots.every((slot) => openSlotTimes.has(slot.getTime()));
}

// Under the @prisma/adapter-pg driver adapter, P2002's `meta` has no
// `target` (what Prisma's docs suggest checking) — verified live, it carries
// `modelName` plus `driverAdapterError.cause.constraint` instead. Appointment
// has exactly one unique constraint besides its cuid primary key (the
// series-occurrence one), so the model name is enough to tell "this week was
// already materialized" apart from "that slot was just taken."
function isOccurrenceConflict(error: Prisma.PrismaClientKnownRequestError): boolean {
    return (error.meta as { modelName?: string } | undefined)?.modelName === "Appointment";
}

export type BookOccurrenceResult =
    | { ok: true; appointment: Appointment }
    | { ok: false; error: string; status: number; alreadyMaterialized?: boolean };

// Shared by POST /api/appointments (one-off booking) and materializeSeries()
// below (once per new occurrence of a standing appointment) — same
// availability check + Appointment/AppointmentSlot transaction either way.
export async function bookOccurrence(params: {
    userId: string;
    artistId: string;
    serviceId: string;
    serviceDurationMinutes: number;
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
    const { userId, artistId, serviceId, serviceDurationMinutes, startTime, recurringAppointmentId, occurrenceDate, allowPast } = params;

    const endTime = new Date(startTime.getTime() + serviceDurationMinutes * 60_000);
    const slots = slotStartsFor(startTime, serviceDurationMinutes);

    if (!(await isFullyOpen(artistId, slots, allowPast ?? false))) {
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
                    occurrenceDate,
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
            if (isOccurrenceConflict(error)) {
                return { ok: false, error: "That week is already booked", status: 409, alreadyMaterialized: true };
            }
            return { ok: false, error: "That time was just booked, please pick another", status: 409 };
        }

        throw error;
    }
}

export type MaterializeResult = {
    recurringAppointmentId: string;
    created: { appointmentId: string; occurrenceDate: string; startTime: Date }[];
    reactivated: { appointmentId: string; occurrenceDate: string; startTime: Date }[];
    skipped: { occurrenceDate: string; startTime: Date; reason: string; newlyRecorded: boolean }[];
};

// Books every week of one series whose date falls after `fromDateExclusive`,
// up to the rolling horizon (and never past seriesEnd). Used by series
// creation, the daily job, and Resume — one code path, so all three agree on
// what "already handled" means. Idempotent and safe to run concurrently: the
// (recurringAppointmentId, occurrenceDate) unique constraints on Appointment
// and RecurringSkippedOccurrence are the backstop.
//
// Per week, in order:
// 1. A skip record exists           -> handled (skips are final, never retried)
// 2. A row exists, not series-freed -> handled (active, completed, no-show,
//    rescheduled to another day, or cancelled on its own by customer/admin)
// 3. A row exists, freed by a series-level pause/cancel -> reactivate that row
// 4. No row                          -> book it
// 5. 3 or 4 failed                   -> record a skip
export async function materializeSeries(
    seriesId: string,
    options: {
        fromDateExclusive: Date;
        now?: Date;
        // Only the creation route passes true, and only for an admin caller
        // backdating a series (Gap 3). The job and Resume never do: they must
        // never book appointments that should already have happened.
        allowPast?: boolean;
    }
): Promise<MaterializeResult> {
    const now = options.now ?? new Date();
    const allowPast = options.allowPast ?? false;

    const series = await prisma.recurringAppointment.findUniqueOrThrow({
        where: { id: seriesId },
        include: {
            artist: { select: { active: true } },
            service: { select: { durationMinutes: true } },
        },
    });

    const result: MaterializeResult = { recurringAppointmentId: seriesId, created: [], reactivated: [], skipped: [] };

    const dates = generateOccurrenceDates(
        series.seriesStart,
        series.intervalWeeks,
        materializationHorizon(now),
        series.seriesEnd
    ).filter((date) => date.getTime() > options.fromDateExclusive.getTime());
    if (dates.length === 0) return result;

    const keys = dates.map(toLocalDateKey);
    const [existingRows, existingSkips] = await Promise.all([
        prisma.appointment.findMany({
            where: { recurringAppointmentId: seriesId, occurrenceDate: { in: keys } },
            select: { id: true, occurrenceDate: true, cancelledBySeries: true, startTime: true, endTime: true },
        }),
        prisma.recurringSkippedOccurrence.findMany({
            where: { recurringAppointmentId: seriesId, occurrenceDate: { in: keys } },
            select: { occurrenceDate: true },
        }),
    ]);
    const rowByDate = new Map(existingRows.map((row) => [row.occurrenceDate, row]));
    const skippedDates = new Set(existingSkips.map((skip) => skip.occurrenceDate));

    for (const date of dates) {
        const occurrenceDate = toLocalDateKey(date);
        const startTime = timeStringToDate(date, series.startTime);

        if (skippedDates.has(occurrenceDate)) continue;
        const existing = rowByDate.get(occurrenceDate);
        if (existing && !existing.cancelledBySeries) continue;
        // A freed row comes back at its own stored time, not the series'
        // canonical one — if an admin had moved that week before the pause,
        // Resume restores the booking as it was rather than undoing the move.
        const occurrenceStart = existing ? existing.startTime : startTime;

        let failureReason: string | null = null;
        if (!series.artist.active) {
            failureReason = SKIP_REASON.ARTIST_INACTIVE;
        } else if (!allowPast && occurrenceStart.getTime() < now.getTime()) {
            failureReason = SKIP_REASON.PASSED;
        } else if (existing) {
            const reactivated = await reactivateOccurrence(existing.id, series.artistId, existing.startTime, existing.endTime);
            if (reactivated) {
                result.reactivated.push({ appointmentId: existing.id, occurrenceDate, startTime: existing.startTime });
            } else {
                failureReason = SKIP_REASON.UNAVAILABLE;
            }
        } else {
            const booked = await bookOccurrence({
                userId: series.userId,
                artistId: series.artistId,
                serviceId: series.serviceId,
                serviceDurationMinutes: series.service.durationMinutes,
                startTime,
                recurringAppointmentId: seriesId,
                occurrenceDate,
                allowPast,
            });
            if (booked.ok) {
                result.created.push({ appointmentId: booked.appointment.id, occurrenceDate, startTime });
            } else if (!booked.alreadyMaterialized) {
                // alreadyMaterialized means a concurrent run (or a Resume
                // click) booked this week first — handled, not a skip.
                failureReason = SKIP_REASON.UNAVAILABLE;
            }
        }

        if (failureReason) {
            const newlyRecorded = await recordSkip(seriesId, occurrenceDate, failureReason);
            result.skipped.push({ occurrenceDate, startTime: occurrenceStart, reason: failureReason, newlyRecorded });
        }
    }

    return result;
}

// Re-claims slots for a week a series-level pause/cancel freed, keeping the
// same Appointment row at its own stored time (one row per occurrence is
// what the unique constraint requires, and delete-then-recreate would break
// this project's soft-delete convention). Returns false if the time has
// since been taken.
async function reactivateOccurrence(
    appointmentId: string,
    artistId: string,
    startTime: Date,
    endTime: Date
): Promise<boolean> {
    const slots = slotStartsFor(startTime, (endTime.getTime() - startTime.getTime()) / 60_000);
    if (!(await isFullyOpen(artistId, slots, false))) return false;

    try {
        await prisma.$transaction(async (tx) => {
            await tx.appointmentSlot.createMany({
                data: slots.map((slotStart) => ({ artistId, slotStart, appointmentId })),
            });
            await tx.appointment.update({
                where: { id: appointmentId },
                data: {
                    status: "UPCOMING",
                    cancelledBySeries: false,
                    paymentMethod: null,
                    checkedOutAt: null,
                    // So the restored week still gets its 24h reminder.
                    reminderSentAt: null,
                },
            });
        });
        return true;
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
        throw error;
    }
}

// Returns whether this call created the record — false means another run
// already recorded (and emailed about) this skip.
async function recordSkip(recurringAppointmentId: string, occurrenceDate: string, reason: string): Promise<boolean> {
    try {
        await prisma.recurringSkippedOccurrence.create({ data: { recurringAppointmentId, occurrenceDate, reason } });
        return true;
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
        throw error;
    }
}

export type StandingConflict = {
    recurringAppointmentId: string;
    customerName: string | null;
    customerEmail: string;
};

// Advisory check for an admin booking a one-off far ahead: does this slot
// fall on a week an ACTIVE standing appointment will claim, but hasn't been
// materialized yet (past its booked-through date)? Within the horizon the
// series' own rows already hold the slot, so the normal availability check
// covers it — this only matters beyond it, where the booking would succeed
// now and the series would silently skip that week later. A warning, never a
// block: the rule is an advisory claim, real Appointment rows stay the
// source of truth.
export async function findStandingConflicts(
    artistId: string,
    startTime: Date,
    durationMinutes: number
): Promise<StandingConflict[]> {
    const day = startOfDay(startTime);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

    const candidates = await prisma.recurringAppointment.findMany({
        where: {
            artistId,
            status: RecurringStatus.ACTIVE,
            dayOfWeek: startTime.getDay(),
            seriesStart: { lte: day },
            AND: [
                { OR: [{ seriesEnd: null }, { seriesEnd: { gte: day } }] },
                { OR: [{ materializedThrough: null }, { materializedThrough: { lt: day } }] },
            ],
        },
        include: {
            service: { select: { durationMinutes: true } },
            user: { select: { name: true, email: true } },
        },
    });

    return candidates
        .filter((series) => {
            // Same week cadence as the series (every N weeks from seriesStart).
            // Math.round absorbs the 23/25-hour days around DST changes.
            const daysApart = Math.round((day.getTime() - startOfDay(series.seriesStart).getTime()) / 86_400_000);
            if (daysApart % (series.intervalWeeks * 7) !== 0) return false;

            // Same half-open interval overlap test used everywhere else here.
            const seriesStartTime = timeStringToDate(day, series.startTime);
            const seriesEndTime = new Date(seriesStartTime.getTime() + series.service.durationMinutes * 60_000);
            return seriesStartTime < endTime && startTime < seriesEndTime;
        })
        .map((series) => ({
            recurringAppointmentId: series.id,
            customerName: series.user.name,
            customerEmail: series.user.email,
        }));
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

// Moves a series' watermark forward to the current horizon, never backward.
async function advanceWatermark(seriesId: string, now: Date) {
    const horizon = materializationHorizon(now);
    await prisma.recurringAppointment.updateMany({
        where: {
            id: seriesId,
            OR: [{ materializedThrough: null }, { materializedThrough: { lt: horizon } }],
        },
        data: { materializedThrough: horizon },
    });
}

export type MaterializeAllResult = {
    results: MaterializeResult[];
    errors: { recurringAppointmentId: string; error: string }[];
};

// The daily job: extends every ACTIVE series up to the rolling horizon.
// PAUSED/CANCELLED series are never materialized — that's what would
// otherwise silently re-create exactly what Pause/Cancel freed.
//
// At-least-once: each series' watermark advances only after its loop
// finishes, so a crash mid-series just means the next run redoes it, which
// the unique constraints make harmless. (Claiming the window first would be
// at-most-once — a crash would leave permanent, silent gaps.)
export async function materializeAllSeries(
    options: {
        now?: Date;
        // Verification scripts only — scopes a simulated run to their own
        // fixtures so it can't touch anyone else's series. The job route
        // never passes it.
        seriesIds?: string[];
    } = {}
): Promise<MaterializeAllResult> {
    const now = options.now ?? new Date();
    const horizon = materializationHorizon(now);

    const due = await prisma.recurringAppointment.findMany({
        where: {
            ...(options.seriesIds ? { id: { in: options.seriesIds } } : {}),
            status: RecurringStatus.ACTIVE,
            OR: [{ materializedThrough: null }, { materializedThrough: { lt: horizon } }],
            AND: [{ OR: [{ seriesEnd: null }, { seriesEnd: { gte: startOfDay(now) } }] }],
        },
        select: { id: true, seriesStart: true, materializedThrough: true },
    });

    const output: MaterializeAllResult = { results: [], errors: [] };
    for (const series of due) {
        // One broken series (e.g. its service was removed out from under
        // it) is reported, not allowed to stop the rest of the run.
        try {
            const result = await materializeSeries(series.id, {
                fromDateExclusive: series.materializedThrough ?? addDays(series.seriesStart, -1),
                now,
            });
            await advanceWatermark(series.id, now);
            output.results.push(result);
        } catch (error) {
            output.errors.push({
                recurringAppointmentId: series.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return output;
}

export type RecurringStatusChangeResult = {
    recurringAppointment: RecurringAppointment;
    previousStatus: RecurringStatus;
    freedAppointmentIds: string[];
    // Only set when the series was resumed (any non-ACTIVE -> ACTIVE).
    materialization: MaterializeResult | null;
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
// and must stay free of server-only imports.
export async function applyRecurringStatusChange(
    recurringAppointmentId: string,
    status: RecurringStatus,
    options: { respectNoticeWindow: boolean; now?: Date }
): Promise<RecurringStatusChangeResult> {
    const now = options.now ?? new Date();

    const { recurringAppointment, previousStatus, freedAppointmentIds } = await prisma.$transaction(async (tx) => {
        // findUniqueOrThrow so a missing series still surfaces as P2025,
        // which the admin route already maps to 404.
        const previous = await tx.recurringAppointment.findUniqueOrThrow({
            where: { id: recurringAppointmentId },
            select: { status: true },
        });

        const recurringAppointment = await tx.recurringAppointment.update({
            where: { id: recurringAppointmentId },
            data: { status },
        });

        let freedAppointmentIds: string[] = [];

        // PAUSED and CANCELLED both mean "stop honoring this series' future
        // commitment" from the schedule's point of view — the only
        // difference between them is whether the series can be turned back
        // on later.
        if (status === RecurringStatus.PAUSED || status === RecurringStatus.CANCELLED) {
            const cutoff = options.respectNoticeWindow
                ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
                : now;

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
                    // cancelledBySeries marks these as freed by the series,
                    // not cancelled on their own — Resume restores exactly
                    // these and nothing else.
                    data: { status: "CANCELLED", cancelledBySeries: true },
                });
            }
        }

        return { recurringAppointment, previousStatus: previous.status, freedAppointmentIds };
    });

    // Resume: rebook from today, deliberately not from the watermark — the
    // weeks the pause freed are behind it. Done after the status transaction
    // commits, not inside it: a partial failure here shouldn't roll back the
    // status change the user asked for, and the next daily run finishes the
    // job anyway.
    let materialization: MaterializeResult | null = null;
    if (status === RecurringStatus.ACTIVE && previousStatus !== RecurringStatus.ACTIVE) {
        materialization = await materializeSeries(recurringAppointmentId, {
            fromDateExclusive: addDays(startOfDay(now), -1),
            now,
        });
        await advanceWatermark(recurringAppointmentId, now);
    }

    return { recurringAppointment, previousStatus, freedAppointmentIds, materialization };
}
