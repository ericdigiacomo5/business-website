import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ArtistSelector } from "@/components/admin/availability/artist-selector"
import { AdminTimeOffManager } from "@/components/admin/time-off/admin-time-off-manager"
import { SALON_WIDE_VALUE } from "@/lib/time-off"

export default async function AdminTimeOffPage({
    searchParams,
}: {
    searchParams: Promise<{ artistId?: string }>
}) {
    const params = await searchParams
    // Inactive artists are hidden everywhere except admin/artists (where
    // they can be reactivated) — including from this selector.
    const artists = await prisma.artist.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } })

    // Land on the first artist by default rather than showing an empty
    // "pick an artist" state on first visit. The salon-wide sentinel counts
    // as a real selection here, same as a concrete artist id — only a
    // genuinely absent param triggers the redirect.
    if (!params.artistId && artists.length > 0) {
        redirect(`/admin/time-off?artistId=${artists[0].id}`)
    }

    const selectedArtistId = params.artistId ?? null
    const isSalonWide = selectedArtistId === SALON_WIDE_VALUE

    const entries = selectedArtistId
        ? await prisma.timeOff.findMany({
              // Salon-wide view shows only salon-wide rows (artistId: null),
              // not "every row for every artist" — mirrors the same
              // artistId-is-the-scope-boundary rule getOpenSlots and the API
              // routes use. Managing an individual artist's time off stays
              // on that artist's own view, unaffected by this mode existing.
              where: { artistId: isSalonWide ? null : selectedArtistId },
              orderBy: [{ date: "asc" }, { startTime: "asc" }],
          })
        : []

    return (
        <div>
            <ArtistSelector artists={artists} currentArtistId={selectedArtistId ?? ""} allowSalonWide />
            {selectedArtistId ? (
                <AdminTimeOffManager
                    artistId={isSalonWide ? null : selectedArtistId}
                    initialEntries={entries}
                />
            ) : (
                <p className="mt-8 text-muted-foreground">No artists yet — add one first.</p>
            )}
        </div>
    )
}