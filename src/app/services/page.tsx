import { prisma } from "@/lib/prisma"
import { ServiceCard } from "@/components/services/service-card"

export default async function ServicesPage() {
    const services = await prisma.service.findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
    })

    return (
        <div className="flex flex-col">
            <section className="bg-accent px-4 py-16 text-center">
                <span className="font-script text-2xl text-primary">Our Menu of</span>
                <h1 className="mt-1 font-serif text-6xl font-extrabold text-background">Services &amp; Pricing</h1>
            </section>

            <div className="mx-auto max-w-6xl px-4 py-14">
                {services.length === 0 ? (
                    <p className="text-muted-foreground">No services are available right now.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                        {services.map((service) => (
                            <ServiceCard key={service.id} service={service} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
