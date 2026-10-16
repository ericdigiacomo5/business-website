import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { MyBookingsList } from "@/components/account/my-bookings-list"
import { MyRecurringAppointments } from "@/components/account/my-recurring-appointments"
import { SERVICE_LINES_INCLUDE } from "@/lib/appointment-services"
import { getPolicySettings } from "@/lib/settings"

export default async function AppointmentsPage() {
    const session = await auth()

    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/appointments")
    }

    const [appointments, policy] = await Promise.all([
        prisma.appointment.findMany({
            where: { userId: session.user.id },
            include: { artist: true, ...SERVICE_LINES_INCLUDE },
            orderBy: { startTime: "asc" },
        }),
        getPolicySettings(),
    ])

    // MyBookingsList seeds local state from its prop once, so a
    // router.refresh() (fired when a standing appointment is cancelled
    // below) wouldn't otherwise reach it. Keying on the rows'
    // ids + statuses remounts it exactly when the server data changed.
    const bookingsKey = appointments.map((a) => `${a.id}:${a.status}`).join(",")

    return (
        <div className="mx-auto max-w-3xl px-4 py-14">
            <span className="font-script text-2xl text-accent">Your</span>
            <h1 className="mt-1 font-serif text-4xl font-extrabold text-foreground">Bookings</h1>
            <MyBookingsList
                key={bookingsKey}
                initialAppointments={appointments}
                cancellationNoticeHours={policy.cancellationNoticeHours}
            />
            <MyRecurringAppointments />
        </div>
    )
}
