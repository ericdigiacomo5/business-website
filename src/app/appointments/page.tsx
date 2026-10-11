import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { MyBookingsList } from "@/components/account/my-bookings-list"
import { MyRecurringAppointments } from "@/components/account/my-recurring-appointments"
import { isBookingEnabled } from "@/lib/settings"

export default async function AppointmentsPage() {
    const session = await auth()

    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/appointments")
    }

    const [appointments, bookingEnabled] = await Promise.all([
        prisma.appointment.findMany({
            where: { userId: session.user.id },
            include: { artist: true, service: true },
            orderBy: { startTime: "asc" },
        }),
        isBookingEnabled(),
    ])

    // MyBookingsList seeds local state from its prop once, so a
    // router.refresh() (fired when a standing appointment is paused, resumed,
    // or cancelled below) wouldn't otherwise reach it. Keying on the rows'
    // ids + statuses remounts it exactly when the server data changed.
    const bookingsKey = appointments.map((a) => `${a.id}:${a.status}`).join(",")

    return (
        <div className="mx-auto max-w-3xl px-4 py-14">
            <span className="font-script text-2xl text-accent">Your</span>
            <h1 className="mt-1 font-serif text-4xl font-extrabold text-foreground">Bookings</h1>
            <MyBookingsList key={bookingsKey} initialAppointments={appointments} />
            {/* "Change time" cancels the series and sends the customer to
                /book — hidden while online booking is closed, since /book
                would then refuse and leave them with nothing. */}
            <MyRecurringAppointments canRebook={bookingEnabled} />
        </div>
    )
}
