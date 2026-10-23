import { Users } from "lucide-react"
import { ArtistCard } from "@/components/artists/artist-card"
import { EmptyState } from "@/components/ui/empty-state"
import { loadArtistCards } from "@/lib/artist-cards"
import { DecoDivider } from "@/components/ui/deco"

export default async function ArtistsPage() {
    const artists = await loadArtistCards()

    return (
        <div className="flex flex-col">
            <section className="bg-accent px-4 py-16 text-center">
                <span className="font-script text-2xl text-muted">The Talent Behind</span>
                <h1 className="mt-1 font-serif text-4xl font-extrabold text-background sm:text-6xl">Our Artists</h1>
                <DecoDivider align="center" className="mt-4 text-primary" />
                <p className="mt-4 text-on-dark">Meet the team and browse their work.</p>
            </section>

            <div className="mx-auto w-full max-w-5xl px-4 py-14">
                {artists.length === 0 ? (
                    <EmptyState icon={Users} title="Our artists are coming soon">
                        We&apos;re putting the team page together. Check back shortly.
                    </EmptyState>
                ) : (
                    <div className="flex flex-col gap-12 md:gap-16">
                        {artists.map((artist) => (
                            <ArtistCard key={artist.id} artist={artist} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
