import { prisma } from "@/lib/prisma"
import { BookingWizard } from "@/components/booking/booking-wizard"

export default async function AdminBookPage() {
    const [services, artists] = await Promise.all([
        prisma.service.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
        // Deactivated artists can't be booked with — see POST /api/appointments
        // and /api/appointments/recurring, which reject them server-side
        // regardless of caller role. Filtering them out here too means the
        // wizard's Artist step never offers a choice that would just fail on
        // confirm. (Other admin pages — the schedule grid, availability,
        // time-off — still fetch all artists unfiltered, since those need to
        // manage/view inactive artists, not book new appointments with them.)
        prisma.artist.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
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
