// Time off over existing bookings (FEATURE_GAPS.md Gap 22) — server-only.
//
// Time off blocks new bookings through getOpenSlots, but on its own it does
// nothing to appointments already booked into that time. Both admin time-off
// routes save through saveTimeOffChecked() below: if live bookings fall
// inside the new time off, the save is refused with the list, and the admin
// either goes back or re-sends with those ids approved — which cancels them
// and saves the time off in one transaction. Nothing is ever cancelled
// without the admin having seen it in the list.

import { prisma } from "@/lib/prisma"
import { AppointmentStatus, type Prisma, type TimeOff } from "@/generated/prisma/client"
import { endOfDay, startOfDay, timeStringToDate } from "@/lib/availability"
import { servicesLabel } from "@/lib/appointment-services"

type Db = Prisma.TransactionClient | typeof prisma

// What a time-off row covers: every day of [date, endDate ?? date], from
// startTime to endTime on each — the same reading getOpenSlots uses.
// artistId null = salon-wide.
export type TimeOffSpan = {
    artistId: string | null
    date: Date
    endDate: Date | null
    startTime: string
    endTime: string
}

// One booking the time off would land on, as the confirmation lists it.
export type TimeOffConflict = {
    id: string
    startTime: string
    endTime: string
    customerName: string
    artistName: string
    services: string
}

const LIVE_STATUSES = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]

// Most a client may approve in one request — a generous bound on a list
// that has to fit on one confirmation screen anyway.
const MAX_APPROVED_IDS = 500

// Ids of the live (pending or confirmed) bookings that overlap the span and
// haven't ended yet, earliest first. A visit that's already over is left
// alone: it either happened and is waiting to be checked out, or it's a
// no-show — cancelling it here would rewrite history.
//
// A flat query on purpose: it runs inside saveTimeOffChecked's transaction,
// and a read with relations makes Prisma send several queries at once on
// the transaction's one connection, which pg only tolerates until v9.
async function findConflictingIds(db: Db, span: TimeOffSpan): Promise<string[]> {
    const candidates = await db.appointment.findMany({
        where: {
            status: { in: LIVE_STATUSES },
            startTime: { gte: startOfDay(span.date), lte: endOfDay(span.endDate ?? span.date) },
            endTime: { gt: new Date() },
            ...(span.artistId ? { artistId: span.artistId } : {}),
        },
        select: { id: true, startTime: true, endTime: true },
        orderBy: { startTime: "asc" },
    })

    return candidates
        .filter((appointment) => {
            const day = startOfDay(appointment.startTime)
            const blockStart = timeStringToDate(day, span.startTime)
            const blockEnd = timeStringToDate(day, span.endTime)
            return appointment.startTime < blockEnd && blockStart < appointment.endTime
        })
        .map((appointment) => appointment.id)
}

// The confirmation's rows for those ids, earliest first. Read outside any
// transaction (see above).
async function describeConflicts(ids: string[]): Promise<TimeOffConflict[]> {
    const rows = await prisma.appointment.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            startTime: true,
            endTime: true,
            artist: { select: { name: true } },
            user: { select: { name: true, email: true } },
            services: { select: { service: { select: { name: true } } }, orderBy: { position: "asc" } },
        },
        orderBy: { startTime: "asc" },
    })

    return rows.map((appointment) => ({
        id: appointment.id,
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime.toISOString(),
        customerName: appointment.user.name || appointment.user.email,
        artistName: appointment.artist.name,
        services: servicesLabel(appointment.services),
    }))
}

// The request's `cancelConflictingAppointmentIds`: omitted = none approved.
// Returns null if it's malformed.
export function parseApprovedIds(value: unknown): string[] | null {
    if (value === undefined) return []
    if (!Array.isArray(value) || value.length > MAX_APPROVED_IDS) return null
    if (!value.every((id) => typeof id === "string" && id.length > 0)) return null
    return value
}

export type SaveTimeOffResult =
    | { ok: true; timeOff: TimeOff; cancelledIds: string[] }
    | { ok: false; conflicts: TimeOffConflict[] }

class UnapprovedConflictsError extends Error {
    constructor(readonly conflictIds: string[]) {
        super("Time off overlaps bookings that weren't approved for cancelling")
    }
}

// Saves time off (write() creates or updates the row) unless it would land
// on a booking the admin hasn't approved cancelling. Conflicts are found
// inside the same transaction as the write, so the list acted on is the
// current one: a booking made after the admin saw the confirmation isn't
// cancelled — it comes back as a new conflict for them to see. Approved ids
// that no longer conflict (cancelled in the meantime) are simply skipped.
export async function saveTimeOffChecked(
    span: TimeOffSpan,
    approvedIds: string[],
    write: (tx: Prisma.TransactionClient) => Promise<TimeOff>
): Promise<SaveTimeOffResult> {
    const approved = new Set(approvedIds)

    try {
        return await prisma.$transaction(async (tx) => {
            const cancelledIds = await findConflictingIds(tx, span)
            if (cancelledIds.some((id) => !approved.has(id))) {
                throw new UnapprovedConflictsError(cancelledIds)
            }

            if (cancelledIds.length > 0) {
                // Same soft-cancel contract as every other cancellation: the
                // row stays as history, only its slots are freed.
                await tx.appointment.updateMany({
                    where: { id: { in: cancelledIds }, status: { in: LIVE_STATUSES } },
                    data: { status: AppointmentStatus.CANCELLED },
                })
                await tx.appointmentSlot.deleteMany({ where: { appointmentId: { in: cancelledIds } } })
            }

            const timeOff = await write(tx)
            return { ok: true as const, timeOff, cancelledIds }
        })
    } catch (error) {
        if (error instanceof UnapprovedConflictsError) {
            return { ok: false, conflicts: await describeConflicts(error.conflictIds) }
        }
        throw error
    }
}

// The 409 body both routes send when the save was refused.
export function conflictsResponse(conflicts: TimeOffConflict[]): Response {
    const count = conflicts.length
    return Response.json(
        {
            error: `${count} booking${count === 1 ? "" : "s"} fall${count === 1 ? "s" : ""} in this time off`,
            conflicts,
        },
        { status: 409 }
    )
}
