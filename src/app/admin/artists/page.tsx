import { prisma } from "@/lib/prisma"
import { AdminArtistsManager } from "@/components/admin/artists/admin-artists-manager"

export default async function AdminArtistsPage() {
    // Unlike public GET /api/artists, this includes inactive artists too —
    // an admin needs to see (and reactivate) deactivated ones.
    const artists = await prisma.artist.findMany({ orderBy: { createdAt: "asc" } })

    return <AdminArtistsManager initialArtists={artists} />
}
