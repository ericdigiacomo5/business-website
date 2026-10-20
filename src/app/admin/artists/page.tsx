import { prisma } from "@/lib/prisma"
import { ARTIST_PAY_TERMS_INCLUDE } from "@/lib/pay-terms"
import { AdminArtistsManager } from "@/components/admin/artists/admin-artists-manager"
import { requireAdminPage } from "@/lib/require-admin-page"
import { ARTIST_SERVICES_INCLUDE } from "@/lib/artist-services"

export default async function AdminArtistsPage() {
    await requireAdminPage("/admin/artists")

    // Unlike public GET /api/artists, this includes inactive artists too —
    // an admin needs to see (and reactivate) deactivated ones. `portfolio`
    // is included so each artist's photo grid is ready as soon as its
    // section is expanded, no separate fetch needed.
    const [artists, services] = await Promise.all([
        prisma.artist.findMany({
            include: { portfolio: true, ...ARTIST_PAY_TERMS_INCLUDE, ...ARTIST_SERVICES_INCLUDE },
            orderBy: { createdAt: "asc" },
        }),
        // For each artist's "services they do" picker. Retired ones too, so
        // a list that includes one shows it (marked) rather than hiding it.
        prisma.service.findMany({
            select: { id: true, name: true, active: true },
            orderBy: [{ active: "desc" }, { createdAt: "asc" }],
        }),
    ])

    return <AdminArtistsManager initialArtists={artists} services={services} />
}
