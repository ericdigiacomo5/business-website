import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SAFE_USER_SELECT } from "@/lib/user-select"
import { AdminUserDetail } from "@/components/admin/users/admin-user-detail"

export default async function AdminUserDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const [user, appointments] = await Promise.all([
        prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT }),
        // Most-recent-first — this page exists to answer "what did she have
        // last time," so the newest booking belongs at the top, not the
        // oldest (the opposite order from the customer-facing My Bookings
        // page, which reads top-down as an upcoming-first itinerary).
        prisma.appointment.findMany({
            where: { userId: id },
            include: { artist: true, service: true },
            orderBy: { startTime: "desc" },
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

            <AdminUserDetail user={user} appointments={appointments} />
        </div>
    )
}
