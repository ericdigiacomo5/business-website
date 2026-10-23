import Link from "next/link"
import { CalendarClock } from "lucide-react"
import type { ArtistCardData } from "@/lib/artist-cards"
import { buttonVariants } from "@/components/ui/button"
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
//
// Styled like the home page carousel's cards: a large round photo
// overlapping a rectangular details card. On a phone the photo sits on top
// of the card (as on the home page); from md up the card runs horizontally
// and the photo overlaps its left edge, centred on it. The negative margin
// pulls the card under the photo and the padding on that side clears it
// again, so the two numbers move together.
export function ArtistCard({ artist }: { artist: ArtistCardData }) {
    const profileHref = `/artists/${artist.id}`
    return (
        <article className="flex flex-col items-center md:flex-row">
            <div className="relative z-10 shrink-0 rounded-full bg-surface p-2 shadow-raised ring-1 ring-primary/60">
                <CloudinaryImage
                    src={artist.photoUrl}
                    alt={artist.name}
                    sizes="(min-width: 1024px) 320px, (min-width: 768px) 288px, 208px"
                    className="h-52 w-52 rounded-full md:h-72 md:w-72 lg:h-80 lg:w-80"
                    fallback={
                        <div className="flex h-52 w-52 items-center justify-center rounded-full bg-muted font-serif text-5xl font-bold text-accent md:h-72 md:w-72 md:text-6xl lg:h-80 lg:w-80">
                            {initials(artist.name)}
                        </div>
                    }
                />
            </div>

            <div className="-mt-24 flex w-full flex-col rounded-xl border border-line bg-surface px-6 pt-32 pb-7 text-center shadow-card md:-ml-36 md:mt-0 md:min-h-96 md:justify-center md:py-10 md:pr-10 md:pl-44 md:text-left lg:-ml-40 lg:pl-52">
                <h2 className="font-serif text-3xl font-bold text-surface-foreground">
                    <Link href={profileHref} className="hover:text-lacquer">
                        {artist.name}
                    </Link>
                </h2>
                {artist.bio && <p className="mt-2 line-clamp-3 text-base leading-relaxed text-body">{artist.bio}</p>}

                {artist.specialties.length > 0 && (
                    <ul className="mt-4 flex flex-wrap justify-center gap-1.5 md:justify-start" aria-label="Specialties">
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

                <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-foreground md:justify-start">
                    <CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {artist.nextOpening ? `Next opening: ${formatOpening(artist.nextOpening)}` : "Fully booked for the next two weeks"}
                </p>

                {artist.thumbnails.length > 0 && (
                    // A mouse shortcut to the portfolio; keyboard and screen
                    // reader users have the name and "See their work" links.
                    <Link
                        href={profileHref}
                        tabIndex={-1}
                        aria-hidden
                        className="mx-auto mt-5 grid w-full max-w-sm grid-cols-3 gap-1.5 md:mx-0"
                    >
                        {artist.thumbnails.map((image) => (
                            <CloudinaryImage
                                key={image.id}
                                src={image.imageUrl}
                                alt=""
                                sizes="(min-width: 768px) 128px, 30vw"
                                className="aspect-square w-full rounded-md transition hover:opacity-90"
                            />
                        ))}
                    </Link>
                )}

                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center md:justify-start">
                    <Link href={`/book?artistId=${artist.id}`} className={buttonVariants({ variant: "gold" })}>
                        {`Book with ${artist.name.split(" ")[0]}`}
                    </Link>
                    <Link
                        href={profileHref}
                        className="inline-flex min-h-11 items-center justify-center px-4 font-semibold text-foreground hover:text-lacquer"
                    >
                        See their work
                    </Link>
                </div>
            </div>
        </article>
    )
}
