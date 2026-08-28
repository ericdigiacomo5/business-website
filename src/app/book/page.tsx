import { prisma } from "@/lib/prisma"
import { BookingWizard } from "@/components/booking/booking-wizard"

export default async function BookPage({
    searchParams,
}: {
    searchParams: Promise<{ serviceId?: string; artistId?: string }>
}) {
    const params = await searchParams

    const [services, artists] = await Promise.all([
        prisma.service.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
        prisma.artist.findMany({ orderBy: { createdAt: "asc" } }),
    ])

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
