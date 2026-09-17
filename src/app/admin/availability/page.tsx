import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ArtistSelector } from "@/components/admin/availability/artist-selector"
import { AdminAvailabilityManager } from "@/components/admin/availability/admin-availability-manager"

export default async function AdminAvailabilityPage({
    searchParams,
}: {
    searchParams: Promise<{ artistId?: string }>
}) {
    const params = await searchParams
    // Inactive artists are hidden everywhere except admin/artists (where
    // they can be reactivated) — including from this selector.
    const artists = await prisma.artist.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } })

    // Land on the first artist by default rather than showing an empty
    // "pick an artist" state on first visit.
    if (!params.artistId && artists.length > 0) {
        redirect(`/admin/availability?artistId=${artists[0].id}`)
    }

    const selectedArtistId = params.artistId ?? null

    const windows = selectedArtistId
        ? await prisma.availability.findMany({
              where: { artistId: selectedArtistId },
              orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          })
        : []

    return (
        <div>
            <ArtistSelector artists={artists} currentArtistId={selectedArtistId ?? ""} />
            {selectedArtistId ? (
                <AdminAvailabilityManager artistId={selectedArtistId} initialWindows={windows} />
            ) : (
                <p className="mt-8 text-muted-foreground">No artists yet — add one first.</p>
            )}
        </div>
    )
}