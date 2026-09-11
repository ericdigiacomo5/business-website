import { prisma } from "@/lib/prisma"
import { BookingWizard } from "@/components/booking/booking-wizard"

export default async function AdminBookPage() {
    const [services, artists] = await Promise.all([
        prisma.service.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
        prisma.artist.findMany({ orderBy: { createdAt: "asc" } }),
    ])

    return (
        <BookingWizard
            initialServices={services}
            initialArtists={artists}
            initialServiceId={null}
            initialArtistId={null}
            adminMode
        />
    )
}
