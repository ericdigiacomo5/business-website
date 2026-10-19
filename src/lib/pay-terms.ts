// Artist pay terms — server-only (runs inside the caller's transaction).
// The only code that writes ArtistPayTerms / ServicePayTerms and the
// checkout snapshots (AppointmentPay / AppointmentServicePay), so the rules
// for when a snapshot is taken live in one place. See the schema comments
// for why these are tables of their own, and PLAN_ARTIST_PAY_REPORT.md.

import { AppointmentStatus, type Prisma } from "@/generated/prisma/client"

type Tx = Prisma.TransactionClient

// For the admin artists / services pages and their routes only — never add
// these to a query whose result can reach a customer.
export const ARTIST_PAY_TERMS_INCLUDE = { payTerms: { select: { commissionBasisPoints: true } } } as const
export const SERVICE_PAY_TERMS_INCLUDE = { payTerms: { select: { serviceFeeCents: true } } } as const

// Sets (or, with null, clears) an artist's commission rate. Setting a rate
// also fills in the rate for the artist's completed visits that were
// checked out while they had none — those visits have no commission at all
// otherwise, so the report could never show a take-home for that period.
// Visits that already have a snapshot keep it: a rate change never rewrites
// a past period.
export async function setArtistCommission(tx: Tx, artistId: string, basisPoints: number | null) {
    if (basisPoints === null) {
        await tx.artistPayTerms.deleteMany({ where: { artistId } })
        return
    }

    await tx.artistPayTerms.upsert({
        where: { artistId },
        create: { artistId, commissionBasisPoints: basisPoints },
        update: { commissionBasisPoints: basisPoints },
    })

    const unrated = await tx.appointment.findMany({
        where: { artistId, status: AppointmentStatus.COMPLETED, pay: null },
        select: { id: true },
    })
    if (unrated.length > 0) {
        await tx.appointmentPay.createMany({
            data: unrated.map(({ id }) => ({ appointmentId: id, commissionBasisPoints: basisPoints, backfilled: true })),
            skipDuplicates: true,
        })
    }
}

// Sets a service's fee charged to the artist; 0 removes it. Unlike the
// commission rate, never applied to past visits: a visit checked out before
// the fee existed had a $0 fee at the time, and charging artists for work
// already done is not something the app should do quietly.
export async function setServiceFee(tx: Tx, serviceId: string, feeCents: number) {
    if (feeCents === 0) {
        await tx.servicePayTerms.deleteMany({ where: { serviceId } })
        return
    }

    await tx.servicePayTerms.upsert({
        where: { serviceId },
        create: { serviceId, serviceFeeCents: feeCents },
        update: { serviceFeeCents: feeCents },
    })
}

// Called by checkout (PATCH /api/admin/appointments/[id] → COMPLETED), in its
// transaction: records the artist's current rate and each service's current
// fee on the visit. A visit that already has a snapshot (re-marked
// COMPLETED, e.g. to fix its payment method) keeps it — skipDuplicates.
// With no rate set, no AppointmentPay row is written; setArtistCommission()
// fills it in once a rate is saved.
export async function snapshotPayAtCheckout(tx: Tx, appointmentId: string, artistId: string) {
    const terms = await tx.artistPayTerms.findUnique({ where: { artistId } })
    const lines = await tx.appointmentService.findMany({
        where: { appointmentId, pay: null },
        select: { id: true, service: { select: { payTerms: { select: { serviceFeeCents: true } } } } },
    })

    if (terms) {
        await tx.appointmentPay.createMany({
            data: [{ appointmentId, commissionBasisPoints: terms.commissionBasisPoints }],
            skipDuplicates: true,
        })
    }

    if (lines.length > 0) {
        await tx.appointmentServicePay.createMany({
            data: lines.map((line) => ({
                appointmentServiceId: line.id,
                serviceFeeCents: line.service.payTerms?.serviceFeeCents ?? 0,
            })),
            skipDuplicates: true,
        })
    }
}
