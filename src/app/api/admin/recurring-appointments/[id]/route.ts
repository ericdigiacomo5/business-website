import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { sendRecurringStatusNotice } from "@/lib/appointment-emails";
import { RecurringStatus, Prisma } from "@/generated/prisma/client";
import { applyRecurringStatusChange } from "@/lib/booking";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;

    const { id } = await params;

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

    // Resuming a CANCELLED series back to ACTIVE isn't offered by either UI
    // but isn't rejected here either — matching this project's general
    // preference for the UI to guide behavior rather than the API to
    // over-constrain it (see e.g. admin/appointments' PATCH allowing any
    // status combination, trusting requireAdmin() as the actual gate).

    // Read the current status first so the customer is only emailed on an
    // actual transition (re-cancelling an already-cancelled series stays
    // silent). A missing row is still left to the P2025 catch below.
    const previous = await prisma.recurringAppointment.findUnique({
        where: { id },
        select: { status: true },
    });

    try {
        const result = await applyRecurringStatusChange(id, status as RecurringStatus, {
            // Admin: no notice-window restriction, same as
            // PATCH /api/admin/appointments/[id].
            respectNoticeWindow: false,
        });

        if ((status === "PAUSED" || status === "CANCELLED") && previous?.status !== status) {
            const freedIds = result.freedAppointmentIds;
            after(() => sendRecurringStatusNotice(id, status, "salon", freedIds));
        }

        return Response.json({ data: result });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return Response.json({ error: "Recurring appointment not found" }, { status: 404 });
        }

        throw error;
    }
}
