import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { readJsonObject } from "@/lib/request";
import { SAFE_USER_SELECT_BASIC } from "@/lib/user-select";
import { sendRecurringCancelledNotice } from "@/lib/appointment-emails";
import { Prisma } from "@/generated/prisma/client";
import { cancelRecurringSeries, upcomingSkipsInclude } from "@/lib/booking";
import { SERVICE_LINES_INCLUDE } from "@/lib/appointment-services";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;

    const { id } = await params;

    const body = await readJsonObject(request);
    if (body instanceof Response) return body;

    // Cancelling is the only change a standing appointment supports — no
    // pause, no resume, no editing. Kept as PATCH { status } rather than
    // DELETE because it's a soft status change, not a row deletion.
    const { status } = body;
    if (status !== "CANCELLED") {
        return Response.json(
            { error: "A standing appointment can only be cancelled" },
            { status: 400 }
        );
    }

    try {
        const result = await cancelRecurringSeries(id, {
            // Admin: no notice-window restriction, same as
            // PATCH /api/admin/appointments/[id].
            noticeHours: 0,
        });

        // Customer email only on an actual transition — re-cancelling stays
        // silent.
        if (result.previousStatus !== "CANCELLED") {
            const freedIds = result.freedAppointmentIds;
            after(() => sendRecurringCancelledNotice(id, "salon", freedIds));
        }

        // Re-read with the relations the series lists render.
        const refreshed = await prisma.recurringAppointment.findUnique({
            where: { id },
            include: {
                artist: true,
                ...SERVICE_LINES_INCLUDE,
                user: { select: SAFE_USER_SELECT_BASIC },
                ...upcomingSkipsInclude(),
            },
        });

        return Response.json({ data: { ...result, recurringAppointment: refreshed } });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return Response.json({ error: "Recurring appointment not found" }, { status: 404 });
        }

        throw error;
    }
}
