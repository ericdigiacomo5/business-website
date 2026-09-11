import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { AppointmentStatus, type Prisma } from "@/generated/prisma/client"
import { BookingFilters } from "@/components/admin/booking-filters"
import { ScheduleGrid } from "@/components/admin/schedule-grid"
import { BookingToggle } from "@/components/admin/booking-toggle"
import { DatePicker } from "@/components/admin/admin-date-picker"
import { startOfDay, endOfDay, getWorkingWindows, getGridBounds } from "@/lib/availability"
import { toLocalDateKey, parseLocalDate } from "@/lib/format"
import { isBookingEnabled } from "@/lib/settings"

export default async function AdminBookingsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; artistId?: string, dateString?: string, dateDown?: string, dateUp?: string }>
}) {
    const params = await searchParams
    const statusParam = params.status ?? ""
    const artistIdParam = params.artistId ?? ""

    const parsedDate = params.dateString ? parseLocalDate(params.dateString) : null
    const date = parsedDate ?? new Date()

    // The picker submits a delta (dateDown/dateUp), not a computed date —
    // the server does the arithmetic and redirects to a canonical
    // ?dateString= URL, same "default via redirect()" pattern already used
    // in admin/availability and admin/time-off. This also covers "no
    // dateString yet" and "malformed dateString" by falling back to today,
    // so the URL — not a transient delta — is always the source of truth
    // for which day is being viewed (survives a reload or a shared link).
    const delta = params.dateDown ? -1 : params.dateUp ? 1 : 0
    if (delta !== 0 || !parsedDate) {
        const newDate = new Date(date)
        newDate.setDate(newDate.getDate() + delta)

        const query = new URLSearchParams()
        query.set("dateString", toLocalDateKey(newDate))
        if (statusParam) query.set("status", statusParam)
        if (artistIdParam) query.set("artistId", artistIdParam)

        redirect(`/admin?${query.toString()}`)
    }

    const where: Prisma.AppointmentWhereInput = {
        startTime: {
            gte: startOfDay(date),
            lte: endOfDay(date)
        }
    }

    if (statusParam && (Object.values(AppointmentStatus) as string[]).includes(statusParam)) {
        where.status = statusParam as AppointmentStatus
    }

    if (artistIdParam) {
        where.artistId = artistIdParam
    }

    const [appointments, allArtists, bookingEnabled] = await Promise.all([
        prisma.appointment.findMany({
            where,
            include: { artist: true, service: true, user: true },
            orderBy: { startTime: "asc" },
        }),
        prisma.artist.findMany({ orderBy: { createdAt: "asc" } }),
        isBookingEnabled(),
    ])

    // The artistId filter already scopes `appointments` server-side above —
    // narrowing the schedule grid to a single column here too keeps that
    // truthful. Showing every column with only one populated would misleadingly
    // imply the others were verified empty, when their data was simply never
    // fetched.
    const artists = artistIdParam ? allArtists.filter((a) => a.id === artistIdParam) : allArtists
    const workingWindows = await getWorkingWindows(artists.map((a) => a.id), date)
    const gridBounds = getGridBounds(workingWindows)

    return (
        <div>
            <div className="mb-6">
                <BookingToggle initialEnabled={bookingEnabled} />
            </div>
            <BookingFilters
                artists={allArtists}
                currentStatus={statusParam}
                currentArtistId={artistIdParam}
                currentDateString={toLocalDateKey(date)}
            />
            <DatePicker date={date} status={statusParam} artistId={artistIdParam} />
            <ScheduleGrid
                initialAppointments={appointments}
                artists={artists}
                workingWindows={workingWindows}
                gridBounds={gridBounds}
            />
        </div>
    )
}