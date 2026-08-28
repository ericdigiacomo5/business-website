import { prisma } from "@/lib/prisma"
import { ArtistCard } from "@/components/artists/artist-card"

export default async function ArtistsPage() {
    const artists = await prisma.artist.findMany({ orderBy: { createdAt: "asc" } })

    return (
        <div className="mx-auto max-w-5xl px-4 py-12">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Our Artists</h1>
            <p className="mt-2 text-muted-foreground">Meet the team and browse their work.</p>

            {artists.length === 0 ? (
                <p className="mt-8 text-muted-foreground">No artists are listed right now.</p>
            ) : (
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {artists.map((artist) => (
                        <ArtistCard key={artist.id} artist={artist} />
                    ))}
                </div>
            )}
        </div>
    )
}
