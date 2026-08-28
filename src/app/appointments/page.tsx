import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { MyBookingsList } from "@/components/account/my-bookings-list"

export default async function AppointmentsPage() {
    const session = await auth()

    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/appointments")
    }

    const appointments = await prisma.appointment.findMany({
        where: { userId: session.user.id },
        include: { artist: true, service: true },
        orderBy: { startTime: "asc" },
    })

    return (
        <div className="mx-auto max-w-3xl px-4 py-12">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">My Bookings</h1>
            <MyBookingsList initialAppointments={appointments} />
        </div>
    )
}
