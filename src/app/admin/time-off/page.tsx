import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ArtistSelector } from "@/components/admin/availability/artist-selector"
import { AdminTimeOffManager } from "@/components/admin/time-off/admin-time-off-manager"

export default async function AdminTimeOffPage({
    searchParams,
}: {
    searchParams: Promise<{ artistId?: string }>
}) {
    const params = await searchParams
    const artists = await prisma.artist.findMany({ orderBy: { createdAt: "asc" } })

    // Land on the first artist by default rather than showing an empty
    // "pick an artist" state on first visit.
    if (!params.artistId && artists.length > 0) {
        redirect(`/admin/time-off?artistId=${artists[0].id}`)
    }

    const selectedArtistId = params.artistId ?? null

    const entries = selectedArtistId
        ? await prisma.timeOff.findMany({
              where: { artistId: selectedArtistId },
              orderBy: [{ date: "asc" }, { startTime: "asc" }],
          })
        : []

    return (
        <div>
            <ArtistSelector artists={artists} currentArtistId={selectedArtistId ?? ""} />
            {selectedArtistId ? (
                <AdminTimeOffManager artistId={selectedArtistId} initialEntries={entries} />
            ) : (
                <p className="mt-8 text-muted-foreground">No artists yet — add one first.</p>
            )}
        </div>
    )
}