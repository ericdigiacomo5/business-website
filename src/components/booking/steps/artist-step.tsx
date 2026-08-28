import type { Artist } from "@/generated/prisma/client"

export function ArtistStep({
    artists,
    selectedId,
    onSelect,
}: {
    artists: Artist[]
    selectedId: string | null
    onSelect: (artistId: string) => void
}) {
    return (
        <div>
            <h2 className="text-lg font-semibold text-foreground">Choose an Artist</h2>
            <div className="mt-4 flex flex-col gap-3">
                {artists.map((artist) => {
                    const selected = artist.id === selectedId
                    return (
                        <button
                            key={artist.id}
                            type="button"
                            onClick={() => onSelect(artist.id)}
                            className={
                                "flex min-h-11 items-center gap-3 rounded-xl border p-4 text-left transition-colors " +
                                (selected
                                    ? "border-primary bg-primary/5"
                                    : "border-border bg-surface hover:bg-muted")
                            }
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                {artist.name
                                    .split(" ")
                                    .map((p) => p[0])
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase()}
                            </span>
                            <span className="font-medium text-surface-foreground">{artist.name}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
