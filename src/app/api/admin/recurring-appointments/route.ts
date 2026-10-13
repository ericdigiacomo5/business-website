import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { RecurringStatus, type Prisma } from "@/generated/prisma/client";
import { SAFE_USER_SELECT_BASIC } from "@/lib/user-select";
import { upcomingSkipsInclude } from "@/lib/booking";
import { SERVICE_LINES_INCLUDE } from "@/lib/appointment-services";

// No userId required — the dedicated /admin/recurring page runs this
// unfiltered (every series, salon-wide); /admin/users/[id]'s own view calls
// this same route with userId fixed to that customer. Same relationship
// GET /api/admin/appointments already has between its salon-wide default and
// its optional artistId/status/date-range filters.
export async function GET(request: NextRequest) {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;

    const userId = request.nextUrl.searchParams.get("userId");
    const status = request.nextUrl.searchParams.get("status");

    const where: Prisma.RecurringAppointmentWhereInput = {};
    if (userId) where.userId = userId;

    if (status) {
        if (!(Object.values(RecurringStatus) as string[]).includes(status)) {
            return Response.json({ error: "Status is invalid" }, { status: 400 });
        }
        where.status = status as RecurringStatus;
    }

    const recurringAppointments = await prisma.recurringAppointment.findMany({
        where,
        include: {
            artist: true,
            ...SERVICE_LINES_INCLUDE,
            // Only actually needed by the salon-wide page (the per-customer
            // view already knows whose page it's on) — included
            // unconditionally anyway, same reasoning GET /api/admin/appointments
            // already applies to always including artist/service/user: one
            // query shape serving both callers is simpler than branching the
            // include on who's asking.
            user: { select: SAFE_USER_SELECT_BASIC },
            ...upcomingSkipsInclude(),
        },
        orderBy: { createdAt: "desc" },
    });

    return Response.json({ data: recurringAppointments });
}
