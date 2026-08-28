'use client'

import type { ChangeEvent } from "react"
import type { Artist } from "@/generated/prisma/client"

// Plain GET form, auto-submitted on change (same pattern as BookingFilters)
// — re-renders the Server Component page scoped to the chosen artist.
export function ArtistSelector({
    artists,
    currentArtistId,
}: {
    artists: Artist[]
    currentArtistId: string
}) {
    function autoSubmit(e: ChangeEvent<HTMLSelectElement>) {
        e.currentTarget.form?.requestSubmit()
    }

    return (
        <form method="get" className="flex items-end gap-3">
            <div>
                <label htmlFor="artistId" className="block text-xs font-medium text-muted-foreground">
                    Artist
                </label>
                <select
                    id="artistId"
                    name="artistId"
                    defaultValue={currentArtistId}
                    onChange={autoSubmit}
                    className="mt-1 h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                >
                    {artists.map((artist) => (
                        <option key={artist.id} value={artist.id}>
                            {artist.name}
                        </option>
                    ))}
                </select>
            </div>

            <button
                type="submit"
                className="h-11 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-surface-foreground hover:bg-muted"
            >
                Switch
            </button>
        </form>
    )
}