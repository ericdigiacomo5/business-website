import Link from "next/link"
import type { Artist } from "@/generated/prisma/client"
import { Card } from "@/components/ui/card"

function initials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
}

export function ArtistCard({ artist }: { artist: Artist }) {
    return (
        <Link href={`/artists/${artist.id}`}>
            <Card className="flex flex-col items-center p-7 text-center transition-colors hover:bg-muted">
                {artist.photoUrl ? (
                    // DB-sourced image, host not yet chosen (roadmap item 5) — plain <img>
                    // rather than next/image, which would throw on a non-allowlisted host.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={artist.photoUrl}
                        alt={artist.name}
                        className="h-24 w-24 rounded-full border-2 border-accent object-cover"
                    />
                ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-accent bg-muted text-lg font-semibold text-accent">
                        {initials(artist.name)}
                    </div>
                )}
                <h3 className="mt-4 font-serif text-xl font-bold text-surface-foreground">{artist.name}</h3>
                {artist.bio && (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{artist.bio}</p>
                )}
            </Card>
        </Link>
    )
}
