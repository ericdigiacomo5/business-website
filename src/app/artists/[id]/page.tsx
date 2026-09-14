import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { buttonVariants } from "@/components/ui/button"
import { PortfolioGallery } from "@/components/artists/portfolio-gallery"

export default async function ArtistDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const artist = await prisma.artist.findUnique({
        where: { id },
        include: { portfolio: true },
    })

    if (!artist) {
        notFound()
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-6">
            <Link
                href="/artists"
                className="inline-block font-jost text-sm font-semibold uppercase tracking-wide text-foreground"
            >
                &larr; All Artists
            </Link>

            <div className="mt-8 flex flex-col items-center gap-10 text-center sm:flex-row sm:items-start sm:text-left">
                {artist.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={artist.photoUrl}
                        alt={artist.name}
                        className="h-36 w-36 flex-none rounded-full border-2 border-accent object-cover"
                    />
                ) : (
                    <div className="flex h-36 w-36 flex-none items-center justify-center rounded-full border-2 border-accent bg-muted text-3xl font-semibold text-accent">
                        {artist.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                    </div>
                )}
                <div>
                    <span className="font-script text-2xl text-accent">Meet</span>
                    <h1 className="mt-1 font-serif text-4xl font-extrabold text-foreground">{artist.name}</h1>
                    {artist.bio && (
                        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                            {artist.bio}
                        </p>
                    )}
                    <Link
                        href={`/book?artistId=${artist.id}`}
                        className={buttonVariants({ size: "lg", className: "mt-6" })}
                    >
                        Book with {artist.name.split(" ")[0]}
                    </Link>
                </div>
            </div>

            <h2 className="mt-14 border-b-2 border-foreground pb-3 font-serif text-2xl font-extrabold text-foreground">
                Portfolio
            </h2>
            <div className="mt-6">
                <PortfolioGallery images={artist.portfolio} />
            </div>
        </div>
    )
}
