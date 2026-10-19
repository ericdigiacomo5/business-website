import { prisma } from "@/lib/prisma"
import { ARTIST_PAY_TERMS_INCLUDE } from "@/lib/pay-terms"
import { AdminArtistsManager } from "@/components/admin/artists/admin-artists-manager"

export default async function AdminArtistsPage() {
    // Unlike public GET /api/artists, this includes inactive artists too —
    // an admin needs to see (and reactivate) deactivated ones. `portfolio`
    // is included so each artist's photo grid is ready as soon as its
    // section is expanded, no separate fetch needed.
    const artists = await prisma.artist.findMany({
        include: { portfolio: true, ...ARTIST_PAY_TERMS_INCLUDE },
        orderBy: { createdAt: "asc" },
    })

    return <AdminArtistsManager initialArtists={artists} />
}
