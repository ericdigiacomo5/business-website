import { prisma } from "@/lib/prisma"
import { formatPrice } from "@/lib/format"
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABEL } from "@/lib/service-category"

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
                <span className="font-script text-2xl text-primary">Our Menu of</span>
                <h1 className="mt-1 font-serif text-6xl font-extrabold text-background">
                    Services &amp; Pricing
                </h1>
            </section>

            <div className="mx-auto w-full max-w-2xl px-4 py-14">
                {sections.length === 0 ? (
                    <p className="text-muted-foreground">No services are available right now.</p>
                ) : (
                    <div className="flex flex-col gap-12">
                        {sections.map(({ category, services }) => (
                            <section key={category} aria-labelledby={`category-${category}`}>
                                <h2
                                    id={`category-${category}`}
                                    className="border-b-2 border-foreground pb-2 font-serif text-3xl font-bold text-foreground"
                                >
                                    {SERVICE_CATEGORY_LABEL[category]}
                                </h2>
                                <ul className="divide-y divide-border">
                                    {services.map((service) => (
                                        <li
                                            key={service.id}
                                            className="flex items-baseline justify-between gap-4 py-4"
                                        >
                                            <span className="text-base text-foreground">
                                                {service.name}
                                            </span>
                                            <span className="shrink-0 font-jost font-semibold text-primary">
                                                {formatPrice(service.priceCents)}
                                            </span>
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
