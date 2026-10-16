import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRecurringCancelledNotice } from "@/lib/appointment-emails";
import { requireUser } from "@/lib/require-user";
import { readJsonObject } from "@/lib/request";
import { getPolicySettings } from "@/lib/settings";
import { cancelRecurringSeries, upcomingSkipsInclude } from "@/lib/booking";
import { SERVICE_LINES_INCLUDE } from "@/lib/appointment-services";

// Customer self-service cancel of their own standing appointment
// (FEATURE_GAPS.md Gap 11) — the only change a series supports. Separate route from the /admin/ one
// rather than one route branching on role — matches this project's existing
// convention of a fully separate route per audience (GET /api/appointments/me
// vs GET /api/admin/appointments).
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await requireUser();
    if (userId instanceof Response) return userId;

    const { id } = await params;

    const recurringAppointment = await prisma.recurringAppointment.findUnique({ where: { id } });
    if (!recurringAppointment) {
        return Response.json({ error: "Recurring appointment not found" }, { status: 404 });
    }

    // requireUser() only confirms *someone* is signed in — without this, any
    // authenticated customer could cancel any other customer's series
    // by id. Same two-step shape as DELETE /api/appointments/[id].
    if (recurringAppointment.userId !== userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await readJsonObject(request);
    if (body instanceof Response) return body;

    const { status } = body;
    if (status !== "CANCELLED") {
        return Response.json(
            { error: "A standing appointment can only be cancelled" },
            { status: 400 }
        );
    }

    const { cancellationNoticeHours } = await getPolicySettings();
    const result = await cancelRecurringSeries(id, {
        // An imminent occurrence (inside the notice window) stays untouched —
        // same policy as cancelling it directly via
        // DELETE /api/appointments/[id]. Without this, "cancel the whole
        // series" would be a backdoor around a notice-window policy that
        // already exists one layer down.
        noticeHours: cancellationNoticeHours,
    });

    // Only on an actual transition — re-cancelling stays silent.
    if (result.previousStatus !== "CANCELLED") {
        const freedIds = result.freedAppointmentIds;
        after(() => sendRecurringCancelledNotice(id, "customer", freedIds));
    }

    // Re-read with the relations the series list renders.
    const refreshed = await prisma.recurringAppointment.findUnique({
        where: { id },
        include: { artist: true, ...SERVICE_LINES_INCLUDE, ...upcomingSkipsInclude() },
    });

    return Response.json({ data: { ...result, recurringAppointment: refreshed } });
}
