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
                                "group flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border p-4 text-left transition-colors " +
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
                            <span className="flex-1 font-medium text-surface-foreground">{artist.name}</span>
                            <span
                                className={
                                    "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition-colors " +
                                    (selected
                                        ? "border-primary bg-primary"
                                        : "border-muted-foreground group-hover:border-primary")
                                }
                            >
                                <span
                                    className={
                                        "h-2 w-2 rounded-full transition-colors " +
                                        (selected
                                            ? "bg-background"
                                            : "bg-transparent group-hover:bg-primary")
                                    }
                                />
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
