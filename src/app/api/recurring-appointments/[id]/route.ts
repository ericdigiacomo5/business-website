import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { RecurringStatus } from "@/generated/prisma/client";
import { applyRecurringStatusChange } from "@/lib/booking";

// Customer self-service pause/resume/cancel of their own standing
// appointment (FEATURE_GAPS.md Gap 11). Separate route from the /admin/ one
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
    // authenticated customer could pause/cancel any other customer's series
    // by id. Same two-step shape as DELETE /api/appointments/[id].
    if (recurringAppointment.userId !== userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
        return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { status } = body as Record<string, unknown>;
    if (typeof status !== "string" || !(Object.values(RecurringStatus) as string[]).includes(status)) {
        return Response.json(
            { error: "Status must be one of ACTIVE, PAUSED, CANCELLED" },
            { status: 400 }
        );
    }

    const result = await applyRecurringStatusChange(id, status as RecurringStatus, {
        // An imminent occurrence (<24h out) stays untouched — same policy as
        // cancelling it directly via DELETE /api/appointments/[id]. Without
        // this, "cancel the whole series" would be a backdoor around a
        // notice-window policy that already exists one layer down.
        respectNoticeWindow: true,
    });

    return Response.json({ data: result });
}
