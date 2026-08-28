import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { buttonVariants } from "@/components/ui/button"
import { ServiceCard } from "@/components/services/service-card"
import { ArtistCard } from "@/components/artists/artist-card"
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site"

export default async function Home() {
    const [services, artists] = await Promise.all([
        prisma.service.findMany({ where: { active: true }, take: 3, orderBy: { createdAt: "asc" } }),
        prisma.artist.findMany({ take: 3, orderBy: { createdAt: "asc" } }),
    ])

    return (
        <div className="flex flex-col">
            <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16 text-center sm:py-24">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    {SITE_NAME}
                </h1>
                <p className="mt-4 max-w-md text-lg text-muted-foreground">{SITE_TAGLINE}</p>
                <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <Link href="/book" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
                        Book Now
                    </Link>
                    <Link
                        href="/artists"
                        className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}
                    >
                        See Our Work
                    </Link>
                </div>
            </section>

            {services.length > 0 && (
                <section className="mx-auto w-full max-w-5xl px-4 py-12">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-foreground">Popular Services</h2>
                        <Link href="/services" className="text-sm font-medium text-primary hover:underline">
                            View all
                        </Link>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {services.map((service) => (
                            <ServiceCard key={service.id} service={service} />
                        ))}
                    </div>
                </section>
            )}

            {artists.length > 0 && (
                <section className="mx-auto w-full max-w-5xl px-4 py-12">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-foreground">Meet the Artists</h2>
                        <Link href="/artists" className="text-sm font-medium text-primary hover:underline">
                            View all
                        </Link>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {artists.map((artist) => (
                            <ArtistCard key={artist.id} artist={artist} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}
