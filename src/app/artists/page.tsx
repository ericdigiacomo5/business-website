import { prisma } from "@/lib/prisma"
import { ArtistCard } from "@/components/artists/artist-card"

export default async function ArtistsPage() {
    const artists = await prisma.artist.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } })

    return (
        <div className="flex flex-col">
            <section className="bg-accent px-4 py-16 text-center">
                <span className="font-script text-2xl text-primary">The Talent Behind</span>
                <h1 className="mt-1 font-serif text-6xl font-extrabold text-background">Our Artists</h1>
                <p className="mt-4 text-[#d8e2ea]">Meet the team and browse their work.</p>
            </section>

            <div className="mx-auto max-w-6xl px-4 py-14">
                {artists.length === 0 ? (
                    <p className="text-muted-foreground">No artists are listed right now.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                        {artists.map((artist) => (
                            <ArtistCard key={artist.id} artist={artist} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
