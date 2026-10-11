import { prisma } from "@/lib/prisma"
import { BookingWizard } from "@/components/booking/booking-wizard"

export default async function AdminBookPage({
    searchParams,
}: {
    // All optional — set by "Change Time" on a standing appointment, which
    // cancels the series and lands here with the same customer/service/
    // artist chosen, so only the new day/time needs picking.
    searchParams: Promise<{ userId?: string; serviceId?: string; artistId?: string }>
}) {
    const params = await searchParams

    const [services, artists, initialUser] = await Promise.all([
        prisma.service.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
        // Deactivated artists can't be booked with — see POST /api/appointments
        // and /api/appointments/recurring, which reject them server-side
        // regardless of caller role. Filtering them out here too means the
        // wizard's Artist step never offers a choice that would just fail on
        // confirm. (Other admin pages — the schedule grid, availability,
        // time-off — still fetch all artists unfiltered, since those need to
        // manage/view inactive artists, not book new appointments with them.)
        prisma.artist.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
        // Explicit select — this crosses into a Client Component, so never
        // ship passwordHash. Same fields as the wizard's own user picker.
        params.userId
            ? prisma.user.findUnique({
                  where: { id: params.userId },
                  select: { id: true, name: true, email: true, phone: true },
              })
            : null,
    ])

    // Same "only trust deep-linked ids that actually exist" rule as /book —
    // e.g. a series whose artist has since been deactivated falls back to
    // the artist step instead of breaking the wizard.
    const initialServiceId = services.some((s) => s.id === params.serviceId) ? params.serviceId! : null
    const initialArtistId = artists.some((a) => a.id === params.artistId) ? params.artistId! : null

    return (
        <BookingWizard
            initialServices={services}
            initialArtists={artists}
            initialServiceId={initialServiceId}
            initialArtistId={initialArtistId}
            initialUser={initialUser}
            adminMode
        />
    )
}
