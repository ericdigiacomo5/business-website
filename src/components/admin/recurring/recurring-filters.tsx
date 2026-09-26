'use client'

import type { ChangeEvent } from "react"
import type { Artist } from "@/generated/prisma/client"

const STATUS_OPTIONS = ["ACTIVE", "PAUSED", "CANCELLED"] as const

// Plain GET form, auto-submitted on change — re-renders this Server
// Component page with the new query params. Same pattern as BookingFilters.
export function RecurringFilters({
    artists,
    currentStatus,
    currentArtistId,
}: {
    artists: Artist[]
    currentStatus: string
    currentArtistId: string
}) {
    function autoSubmit(e: ChangeEvent<HTMLSelectElement>) {
        e.currentTarget.form?.requestSubmit()
    }

    return (
        <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
                <label htmlFor="status" className="block text-xs font-medium text-muted-foreground">
                    Status
                </label>
                <select
                    id="status"
                    name="status"
                    defaultValue={currentStatus}
                    onChange={autoSubmit}
                    className="mt-1 h-11 rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                >
                    <option value="">All</option>
                    {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                            {status}
                        </option>
                    ))}
                </select>
            </div>

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
                    <option value="">All</option>
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
                Filter
            </button>
        </form>
    )
}
