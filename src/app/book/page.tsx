import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { BookingWizard } from "@/components/booking/booking-wizard"
import { getPolicySettings, isBookingEnabled } from "@/lib/settings"
import { customerMaxSeriesWeeks } from "@/lib/booking-limits"
import { ARTIST_SERVICES_INCLUDE, artistOffersAll, offeredServiceIdsOf } from "@/lib/artist-services"

export default async function BookPage({
    searchParams,
}: {
    searchParams: Promise<{ serviceId?: string; artistId?: string }>
}) {
    const params = await searchParams

    const [session, bookingEnabled, policy, services, artists] = await Promise.all([
        auth(),
        isBookingEnabled(),
        getPolicySettings(),
        prisma.service.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
        prisma.artist.findMany({
            where: { active: true },
            include: ARTIST_SERVICES_INCLUDE,
            orderBy: { createdAt: "asc" },
        }),
    ])

    // artistId → the services they perform ([] = every service), as a plain
    // lookup for the wizard.
    const offeredServiceIds = Object.fromEntries(artists.map((artist) => [artist.id, offeredServiceIdsOf(artist)]))

    // Mirrors the exact bypass rule POST /api/appointments enforces server-side
    // — an admin browsing the plain customer /book page (as opposed to
    // booking from the admin schedule grid) can still book, so this page must not show a "closed"
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
    // A link naming both (rare) skips the artist step, so drop an artist who
    // doesn't do that service — the customer then picks from those who do.
    const linkedArtistOk =
        artists.some((a) => a.id === params.artistId) &&
        (!initialServiceId || artistOffersAll(offeredServiceIds[params.artistId!], [initialServiceId]))
    const initialArtistId = linkedArtistOk ? params.artistId! : null

    return (
        <BookingWizard
            initialServices={services}
            initialArtists={artists}
            offeredServiceIds={offeredServiceIds}
            initialServiceId={initialServiceId}
            initialArtistId={initialArtistId}
            // The same cap POST /api/appointments/recurring applies: customers
            // get the shorter of the salon's cap and CUSTOMER_MAX_SERIES_WEEKS.
            maxSeriesWeeks={isAdmin ? policy.maxSeriesWeeks : customerMaxSeriesWeeks(policy.maxSeriesWeeks)}
            cancellationNoticeHours={policy.cancellationNoticeHours}
        />
    )
}
