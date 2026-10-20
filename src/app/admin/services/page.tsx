import { prisma } from "@/lib/prisma"
import { SERVICE_PAY_TERMS_INCLUDE } from "@/lib/pay-terms"
import { AdminServicesManager } from "@/components/admin/services/admin-services-manager"
import { requireAdminPage } from "@/lib/require-admin-page"

export default async function AdminServicesPage() {
    await requireAdminPage("/admin/services")

    // Unlike public GET /api/services, this includes inactive services too
    // — an admin needs to see (and reactivate) deactivated ones.
    const services = await prisma.service.findMany({
        include: SERVICE_PAY_TERMS_INCLUDE,
        orderBy: { createdAt: "asc" },
    })

    return <AdminServicesManager initialServices={services} />
}