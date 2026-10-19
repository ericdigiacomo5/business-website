// Server-only (Prisma): loads what the pay report (/admin/reports/pay)
// needs — every figure is then worked out by the pure functions in
// pay-report.ts. The only reader of the pay snapshot tables besides checkout.

import { prisma } from "@/lib/prisma"
import { AppointmentStatus } from "@/generated/prisma/client"
import { discountOf } from "@/lib/discount"
import { clientShortName, type PayReportVisit } from "@/lib/pay-report"

// Completed visits whose startTime falls within [from, to] — callers pass
// local-day bounds (startOfDay / endOfDay). artistId null = every artist.
export async function loadPayReportVisits({
    from,
    to,
    artistId,
}: {
    from: Date
    to: Date
    artistId: string | null
}): Promise<PayReportVisit[]> {
    const appointments = await prisma.appointment.findMany({
        where: {
            status: AppointmentStatus.COMPLETED,
            startTime: { gte: from, lte: to },
            ...(artistId ? { artistId } : {}),
        },
        select: {
            id: true,
            artistId: true,
            startTime: true,
            createdAt: true,
            discountType: true,
            discountValue: true,
            paymentMethod: true,
            creditAppliedCents: true,
            user: { select: { name: true } },
            pay: { select: { commissionBasisPoints: true, backfilled: true } },
            services: {
                orderBy: { position: "asc" },
                select: {
                    serviceId: true,
                    priceCents: true,
                    service: { select: { name: true, category: true } },
                    pay: { select: { serviceFeeCents: true } },
                },
            },
        },
        orderBy: { startTime: "asc" },
    })

    return appointments.map((appointment) => ({
        id: appointment.id,
        artistId: appointment.artistId,
        startTime: appointment.startTime,
        createdAt: appointment.createdAt,
        clientName: clientShortName(appointment.user.name),
        discount: discountOf(appointment),
        paymentMethod: appointment.paymentMethod,
        creditAppliedCents: appointment.creditAppliedCents,
        commissionBasisPoints: appointment.pay?.commissionBasisPoints ?? null,
        commissionBackfilled: appointment.pay?.backfilled ?? false,
        lines: appointment.services.map((line) => ({
            serviceId: line.serviceId,
            serviceName: line.service.name,
            category: line.service.category,
            priceCents: line.priceCents,
            // No snapshot = checked out before service fees were recorded,
            // when every service's fee was $0 (see setServiceFee()).
            serviceFeeCents: line.pay?.serviceFeeCents ?? 0,
        })),
    }))
}

// Every artist, inactive ones too — a departed artist may still be owed
// for their last period. Active first, then by when they were added.
export async function loadPayReportArtists() {
    return prisma.artist.findMany({
        select: { id: true, name: true, active: true },
        orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    })
}
