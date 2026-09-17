import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { BookingWizard } from "@/components/booking/booking-wizard"
import { isBookingEnabled } from "@/lib/settings"

export default async function BookPage({
    searchParams,
}: {
    searchParams: Promise<{ serviceId?: string; artistId?: string }>
}) {
    const params = await searchParams

    const [session, bookingEnabled, services, artists] = await Promise.all([
        auth(),
        isBookingEnabled(),
        prisma.service.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
        prisma.artist.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    ])

    // Mirrors the exact bypass rule POST /api/appointments enforces server-side
    // — an admin browsing the plain customer /book page (as opposed to
    // /admin/book) can still book, so this page must not show a "closed"
    // wall that the API itself wouldn't actually enforce for them.
    const isAdmin = session?.user?.role === "ADMIN"

    if (!bookingEnabled && !isAdmin) {
        return (
            <div className="mx-auto max-w-lg px-4 py-16 text-center">
                <h1 className="text-2xl font-semibold text-foreground">Online Booking Is Closed</h1>
                <p className="mt-2 text-muted-foreground">
                    We&apos;re not taking online bookings right now. Please contact the salon directly to schedule
                    an appointment.
                </p>
            </div>
        )
    }

    // Only trust deep-linked ids that actually exist — a stale/bad link
    // shouldn't silently break the wizard's step logic.
    const initialServiceId = services.some((s) => s.id === params.serviceId) ? params.serviceId! : null
    const initialArtistId = artists.some((a) => a.id === params.artistId) ? params.artistId! : null

    return (
        <BookingWizard
            initialServices={services}
            initialArtists={artists}
            initialServiceId={initialServiceId}
            initialArtistId={initialArtistId}
        />
    )
}
