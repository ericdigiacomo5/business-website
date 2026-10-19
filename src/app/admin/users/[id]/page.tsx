import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SAFE_USER_SELECT } from "@/lib/user-select"
import { AdminUserDetail } from "@/components/admin/users/admin-user-detail"
import { SERVICE_LINES_INCLUDE } from "@/lib/appointment-services"
import { ADMIN_CREDIT_ENTRY_SELECT } from "@/lib/credit-shared"

export default async function AdminUserDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const [user, appointments, creditEntries] = await Promise.all([
        prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT }),
        // Most-recent-first — this page exists to answer "what did she have
        // last time," so the newest booking belongs at the top, not the
        // oldest (the opposite order from the customer-facing My Bookings
        // page, which reads top-down as an upcoming-first itinerary).
        prisma.appointment.findMany({
            where: { userId: id },
            include: { artist: true, ...SERVICE_LINES_INCLUDE },
            orderBy: { startTime: "desc" },
        }),
        prisma.creditEntry.findMany({
            where: { userId: id },
            select: ADMIN_CREDIT_ENTRY_SELECT,
            orderBy: { createdAt: "desc" },
        }),
    ])

    if (!user) {
        notFound()
    }

    return (
        <div>
            <Link
                href="/admin/users"
                className="inline-block text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
                &larr; Back to Users
            </Link>

            <AdminUserDetail user={user} appointments={appointments} creditEntries={creditEntries} />
        </div>
    )
}
