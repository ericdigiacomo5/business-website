import { prisma } from "@/lib/prisma"
import { AppointmentStatus, type Prisma } from "@/generated/prisma/client"
import { BookingFilters } from "@/components/admin/booking-filters"
import { AdminBookingsList } from "@/components/admin/admin-bookings-list"

export default async function AdminBookingsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; artistId?: string }>
}) {
    const params = await searchParams
    const statusParam = params.status ?? ""
    const artistIdParam = params.artistId ?? ""

    const where: Prisma.AppointmentWhereInput = {}

    if (statusParam && (Object.values(AppointmentStatus) as string[]).includes(statusParam)) {
        where.status = statusParam as AppointmentStatus
    }

    if (artistIdParam) {
        where.artistId = artistIdParam
    }

    const [appointments, artists] = await Promise.all([
        prisma.appointment.findMany({
            where,
            include: { artist: true, service: true, user: true },
            orderBy: { startTime: "asc" },
        }),
        prisma.artist.findMany({ orderBy: { createdAt: "asc" } }),
    ])

    return (
        <div>
            <BookingFilters artists={artists} currentStatus={statusParam} currentArtistId={artistIdParam} />
            <AdminBookingsList initialAppointments={appointments} />
        </div>
    )
}