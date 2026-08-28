import { prisma } from "@/lib/prisma"
import { AdminServicesManager } from "@/components/admin/services/admin-services-manager"

export default async function AdminServicesPage() {
    // Unlike public GET /api/services, this includes inactive services too
    // — an admin needs to see (and reactivate) deactivated ones.
    const services = await prisma.service.findMany({ orderBy: { createdAt: "asc" } })

    return <AdminServicesManager initialServices={services} />
}