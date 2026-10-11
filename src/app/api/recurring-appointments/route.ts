import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { upcomingSkipsInclude } from "@/lib/booking";

// Derives identity from the session, same as GET /api/appointments/me — no
// userId param, a customer can only ever see their own series.
export async function GET() {
    const userId = await requireUser();
    if (userId instanceof Response) return userId;

    const recurringAppointments = await prisma.recurringAppointment.findMany({
        where: { userId },
        include: { artist: true, service: true, ...upcomingSkipsInclude() },
        orderBy: { createdAt: "desc" },
    });

    return Response.json({ data: recurringAppointments });
}
