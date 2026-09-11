'use client'

import type { ChangeEvent } from "react"
import type { Artist } from "@/generated/prisma/client"

const STATUS_OPTIONS = ["UPCOMING", "CONFIRMED", "CANCELLED", "COMPLETED"] as const

// Plain GET form, submitted either automatically on select change or via the
// button — either way it just re-renders this Server Component page with
// the new query params, no fetch/client state involved.
export function BookingFilters({
    artists,
    currentStatus,
    currentArtistId,
    currentDateString,
}: {
    artists: Artist[]
    currentStatus: string
    currentArtistId: string
    currentDateString: string
}) {
    function autoSubmit(e: ChangeEvent<HTMLSelectElement>) {
        e.currentTarget.form?.requestSubmit()
    }

    return (
        <form method="get" className="flex flex-wrap items-end gap-3">
            {/* Carries the currently-viewed date forward — a GET form
                submission replaces the whole query string with only its own
                fields, so without this, changing a filter would silently
                reset DatePicker back to today. */}
            <input type="hidden" name="dateString" value={currentDateString} />
            <div>
                <label htmlFor="status" className="block text-xs font-medium text-muted-foreground">
                    Status
                </label>
                <select
                    id="status"
                    name="status"
                    defaultValue={currentStatus}
                    onChange={autoSubmit}
                    className="mt-1 h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
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
                    className="mt-1 h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
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
                className="h-11 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-surface-foreground hover:bg-muted"
            >
                Filter
            </button>

        </form>

    )
}