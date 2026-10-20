import Link from "next/link"
import { CalendarClock } from "lucide-react"
import type { ArtistCardData } from "@/lib/artist-cards"
import { Card } from "@/components/ui/card"
import { CloudinaryImage } from "@/components/ui/cloudinary-image"
import { formatOpening } from "@/lib/format"

function initials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
}

// A reason to click, not a directory entry (FEATURE_GAPS.md U12): photo,
// what they do, when they're next free, and a peek at their work.
export function ArtistCard({ artist }: { artist: ArtistCardData }) {
    return (
        <Link href={`/artists/${artist.id}`} className="group block h-full">
            <Card className="flex h-full flex-col items-center p-7 text-center transition duration-200 group-hover:shadow-raised motion-safe:group-hover:-translate-y-1">
                <CloudinaryImage
                    src={artist.photoUrl}
                    alt={artist.name}
                    sizes="96px"
                    className="h-24 w-24 rounded-full border-2 border-accent"
                    fallback={
                        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-accent bg-muted text-lg font-semibold text-accent">
                            {initials(artist.name)}
                        </div>
                    }
                />
                <h3 className="mt-4 font-serif text-2xl font-bold text-surface-foreground group-hover:text-lacquer">{artist.name}</h3>
                {artist.bio && (
                    <p className="mt-1 line-clamp-2 text-base leading-relaxed text-body">{artist.bio}</p>
                )}

                {artist.specialties.length > 0 && (
                    <ul className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label="Specialties">
                        {artist.specialties.map((specialty) => (
                            <li
                                key={specialty}
                                className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary-strong ring-1 ring-primary/40"
                            >
                                {specialty}
                            </li>
                        ))}
                    </ul>
                )}

                <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <CalendarClock className="h-4 w-4 text-accent" aria-hidden />
                    {artist.nextOpening ? `Next opening: ${formatOpening(artist.nextOpening)}` : "Fully booked for the next two weeks"}
                </p>

                {artist.thumbnails.length > 0 && (
                    <div className="mt-auto grid w-full grid-cols-3 gap-1.5 pt-5">
                        {artist.thumbnails.map((image) => (
                            <CloudinaryImage
                                key={image.id}
                                src={image.imageUrl}
                                alt={image.caption ?? `Work by ${artist.name}`}
                                sizes="(min-width: 768px) 96px, 30vw"
                                className="aspect-square w-full rounded-md"
                            />
                        ))}
                    </div>
                )}
            </Card>
        </Link>
    )
}
