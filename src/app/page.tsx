import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { buttonVariants } from "@/components/ui/button"
import { ServiceCard } from "@/components/services/service-card"
import { ArtistCard } from "@/components/artists/artist-card"

export default async function Home() {
    const [services, artists] = await Promise.all([
        prisma.service.findMany({ where: { active: true }, take: 3, orderBy: { createdAt: "asc" } }),
        prisma.artist.findMany({ take: 3, orderBy: { createdAt: "asc" } }),
    ])

    return (
        <div className="flex flex-col">
            <section
                className="relative overflow-hidden"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(135deg, #e6c8a4, #e6c8a4 14px, #dcb392 14px, #dcb392 28px)",
                }}
            >
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(100deg, rgba(22,33,44,0.94) 0%, rgba(22,33,44,0.82) 40%, rgba(22,33,44,0.18) 78%)",
                    }}
                />
                
                <div className="relative z-1 mx-auto w-full max-w-6xl px-4 py-20 sm:py-32">
                    <div className="max-w-xl">
                        <span className="inline-block -rotate-3 font-script text-2xl text-primary sm:text-3xl">
                            Est. 2014
                        </span>
                        <div className="mt-3 h-0.5 w-17.5 bg-primary" />
                        <h1 className="mt-5 font-serif text-4xl font-extrabold leading-[1.02] tracking-wide text-background sm:text-6xl">
                            Amityville&apos;s Most
                            <br />
                            Glamorous Nails
                        </h1>
                        <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[#d8e2ea]">
                            Hand &amp; gel nail care with old-Hollywood polish. Walk out feeling like the pin-up on
                            our sign — book in a minute, glow for weeks.
                        </p>
                        <div className="mt-5 text-sm tracking-[8px] text-primary">&#9733; &#9733; &#9733;</div>
                        <div className="mt-7 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row">
                            <Link
                                href="/book"
                                className={buttonVariants({ variant: "gold", size: "lg", className: "w-full sm:w-auto" })}
                            >
                                Book Now
                            </Link>
                            <Link
                                href="/artists"
                                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-primary bg-transparent px-6 font-jost text-base font-semibold uppercase tracking-wide text-background transition-colors hover:bg-background/10 sm:w-auto"
                            >
                                See Our Work
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {services.length > 0 && (
                <section className="mx-auto w-full max-w-6xl px-4 py-14">
                    <div className="flex items-end justify-between gap-3 border-b-2 border-foreground pb-4">
                        <h2 className="font-serif text-3xl font-extrabold text-foreground">Popular Services</h2>
                        <Link
                            href="/services"
                            className="font-jost text-sm font-semibold uppercase tracking-wide text-foreground hover:text-primary"
                        >
                            View All &rarr;
                        </Link>
                    </div>
                    <div className="mt-9 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                        {services.map((service) => (
                            <ServiceCard key={service.id} service={service} />
                        ))}
                    </div>
                </section>
            )}

            {artists.length > 0 && (
                <section className="mx-auto w-full max-w-6xl px-4 py-14">
                    <div className="flex items-end justify-between gap-3 border-b-2 border-foreground pb-4">
                        <h2 className="font-serif text-3xl font-extrabold text-foreground">Meet the Artists</h2>
                        <Link
                            href="/artists"
                            className="font-jost text-sm font-semibold uppercase tracking-wide text-foreground hover:text-primary"
                        >
                            View All &rarr;
                        </Link>
                    </div>
                    <div className="mt-9 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                        {artists.map((artist) => (
                            <ArtistCard key={artist.id} artist={artist} />
                        ))}
                    </div>
                </section>
            )}

            <section className="bg-primary px-4 py-16 text-center">
                <h2 className="font-serif text-3xl font-extrabold text-foreground">
                    Ready for that old-Hollywood shine?
                </h2>
                <p className="mt-3 font-script text-2xl text-accent">Book your appointment in under a minute.</p>
                <Link href="/book" className={buttonVariants({ variant: "inverse", size: "lg", className: "mt-7" })}>
                    Book Now
                </Link>
            </section>
        </div>
    )
}
