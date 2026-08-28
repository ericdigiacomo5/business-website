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
        <div className="mx-auto max-w-3xl px-4 py-12">
            <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                {artist.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={artist.photoUrl}
                        alt={artist.name}
                        className="h-24 w-24 rounded-full object-cover"
                    />
                ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
                        {artist.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                    </div>
                )}
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
                    {artist.name}
                </h1>
                {artist.bio && <p className="mt-2 max-w-xl text-muted-foreground">{artist.bio}</p>}
                <Link
                    href={`/book?artistId=${artist.id}`}
                    className={buttonVariants({ size: "lg", className: "mt-6" })}
                >
                    Book with {artist.name.split(" ")[0]}
                </Link>
            </div>

            <h2 className="mt-12 text-xl font-semibold text-foreground">Portfolio</h2>
            <div className="mt-4">
                <PortfolioGallery images={artist.portfolio} />
            </div>
        </div>
    )
}
