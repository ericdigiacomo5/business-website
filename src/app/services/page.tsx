import Link from "next/link"
import { Sparkles } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatDuration, formatPrice } from "@/lib/format"
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABEL } from "@/lib/service-category"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { DecoDivider } from "@/components/ui/deco"

export default async function ServicesPage() {
    const services = await prisma.service.findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
    })

    // One section per category, in SERVICE_CATEGORIES' display order; a
    // category with no active services is left out rather than shown empty.
    const sections = SERVICE_CATEGORIES.map((category) => ({
        category,
        services: services.filter((service) => service.category === category),
    })).filter((section) => section.services.length > 0)

    return (
        <div className="flex flex-col">
            <section className="bg-accent px-4 py-16 text-center">
                <span className="font-script text-2xl text-muted">Our Menu of</span>
                <h1 className="mt-1 font-serif text-4xl font-extrabold text-background sm:text-6xl">
                    Services &amp; Pricing
                </h1>
                <DecoDivider align="center" className="mt-4 text-primary" />
            </section>

            <div className="mx-auto w-full max-w-2xl px-4 py-14">
                {sections.length === 0 ? (
                    <EmptyState icon={Sparkles} title="Our menu is being updated">
                        Check back soon for services and prices.
                    </EmptyState>
                ) : (
                    <div className="flex flex-col gap-16">
                        {sections.map(({ category, services }) => (
                            <section key={category} aria-labelledby={`category-${category}`}>
                                <h2
                                    id={`category-${category}`}
                                    className="font-serif text-4xl font-extrabold text-foreground"
                                >
                                    {SERVICE_CATEGORY_LABEL[category]}
                                </h2>
                                <DecoDivider className="mt-2 text-primary" />
                                {/* What the page is for is deciding — so each
                                    row says what it is, how long it takes,
                                    and books it (FEATURE_GAPS.md U2). One
                                    raised card per category. */}
                                <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface px-5 shadow-card sm:px-6">
                                    {services.map((service) => (
                                        <li key={service.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                                            <div className="min-w-0">
                                                <div className="flex items-baseline justify-between gap-4 sm:block">
                                                    <h3 className="font-serif text-xl font-bold text-foreground">{service.name}</h3>
                                                    <span className="shrink-0 font-serif text-xl font-bold italic text-lacquer sm:hidden">
                                                        {formatPrice(service.priceCents)}
                                                    </span>
                                                </div>
                                                <p className="mt-0.5 text-sm text-muted-foreground">
                                                    {formatDuration(service.durationMinutes)}
                                                </p>
                                                {service.description && (
                                                    <p className="mt-2 text-base leading-relaxed text-body">{service.description}</p>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                                                <span className="hidden font-serif text-2xl font-bold italic text-lacquer sm:block">
                                                    {formatPrice(service.priceCents)}
                                                </span>
                                                <Link
                                                    href={`/book?serviceId=${service.id}`}
                                                    aria-label={`Book ${service.name}`}
                                                    className={buttonVariants({
                                                        variant: "secondary",
                                                        className: "w-full sm:w-auto",
                                                    })}
                                                >
                                                    Book
                                                </Link>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
