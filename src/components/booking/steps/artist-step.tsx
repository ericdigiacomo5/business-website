import type { Artist } from "@/generated/prisma/client"
import { CloudinaryImage } from "@/components/ui/cloudinary-image"

function initials(name: string) {
    return name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
}

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
            {/* The wizard passes only artists who do every chosen service. */}
            {artists.length === 0 && (
                <p role="status" className="mt-4 text-sm text-muted-foreground">
                    No one artist does all of the services you picked. Go back and book them as separate visits, or
                    contact the salon.
                </p>
            )}
            <div className="mt-4 flex flex-col gap-3">
                {artists.map((artist) => {
                    const selected = artist.id === selectedId
                    return (
                        <button
                            key={artist.id}
                            type="button"
                            onClick={() => onSelect(artist.id)}
                            aria-pressed={selected}
                            className={
                                "pop-on-select group flex min-h-11 cursor-pointer items-center gap-4 rounded-xl p-4 text-left transition " +
                                (selected
                                    ? "border-2 border-lacquer bg-surface shadow-raised"
                                    : "border border-line bg-surface shadow-card hover:shadow-raised")
                            }
                        >
                            {/* People pick a person by face (FEATURE_GAPS.md U6). */}
                            <CloudinaryImage
                                src={artist.photoUrl}
                                alt=""
                                sizes="56px"
                                className="h-14 w-14 shrink-0 rounded-full border-2 border-accent"
                                fallback={
                                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-primary/10 text-sm font-semibold text-primary-strong">
                                        {initials(artist.name)}
                                    </span>
                                }
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block font-serif text-base font-bold text-surface-foreground">{artist.name}</span>
                                {artist.bio && (
                                    <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">{artist.bio}</span>
                                )}
                            </span>
                            <span
                                className={
                                    "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition-colors " +
                                    (selected
                                        ? "border-lacquer bg-lacquer"
                                        : "border-muted-foreground group-hover:border-lacquer")
                                }
                            >
                                <span
                                    className={
                                        "h-2 w-2 rounded-full transition-colors " +
                                        (selected
                                            ? "bg-background"
                                            : "bg-transparent group-hover:bg-lacquer")
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
