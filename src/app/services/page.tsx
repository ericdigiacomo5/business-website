import { prisma } from "@/lib/prisma"
import { ServiceCard } from "@/components/services/service-card"

export default async function ServicesPage() {
    const services = await prisma.service.findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
    })

    return (
        <div className="mx-auto max-w-5xl px-4 py-12">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Services</h1>
            <p className="mt-2 text-muted-foreground">Pick a service to get started.</p>

            {services.length === 0 ? (
                <p className="mt-8 text-muted-foreground">No services are available right now.</p>
            ) : (
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {services.map((service) => (
                        <ServiceCard key={service.id} service={service} />
                    ))}
                </div>
            )}
        </div>
    )
}
