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
        <div className="mx-auto max-w-3xl px-4 py-14">
            <span className="font-script text-2xl text-accent">Your</span>
            <h1 className="mt-1 font-serif text-4xl font-extrabold text-foreground">Bookings</h1>
            <MyBookingsList initialAppointments={appointments} />
        </div>
    )
}
