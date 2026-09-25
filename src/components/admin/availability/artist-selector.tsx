'use client'

import type { ChangeEvent } from "react"
import type { Artist } from "@/generated/prisma/client"
import { SALON_WIDE_VALUE } from "@/lib/time-off"

// Plain GET form, auto-submitted on change (same pattern as BookingFilters)
// — re-renders the Server Component page scoped to the chosen artist.
export function ArtistSelector({
    artists,
    currentArtistId,
    allowSalonWide = false,
}: {
    artists: Artist[]
    currentArtistId: string
    // Adds an "All Artists (Salon-Wide)" option, opted into per-caller so
    // this stays a no-op for admin/availability, which reuses this exact
    // component and has no concept of a salon-wide row.
    allowSalonWide?: boolean
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
                    className="mt-1 h-11 rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                >
                    {allowSalonWide && (
                        <option value={SALON_WIDE_VALUE}>All Artists (Salon-Wide)</option>
                    )}
                    {artists.map((artist) => (
                        <option key={artist.id} value={artist.id}>
                            {artist.name}
                        </option>
                    ))}
                </select>
            </div>

            <button
                type="submit"
                className="h-11 cursor-pointer rounded-sm border border-border bg-surface px-4 text-sm font-medium text-surface-foreground hover:bg-muted"
            >
                Switch
            </button>
        </form>
    )
}