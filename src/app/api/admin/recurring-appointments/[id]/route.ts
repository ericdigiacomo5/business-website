import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { SAFE_USER_SELECT_BASIC } from "@/lib/user-select";
import { sendRecurringResumedNotice, sendRecurringStatusNotice } from "@/lib/appointment-emails";
import { RecurringStatus, Prisma } from "@/generated/prisma/client";
import { applyRecurringStatusChange, upcomingSkipsInclude } from "@/lib/booking";

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

    try {
        const result = await applyRecurringStatusChange(id, status as RecurringStatus, {
            // Admin: no notice-window restriction, same as
            // PATCH /api/admin/appointments/[id].
            respectNoticeWindow: false,
        });

        // Customer emails only on an actual transition — re-sending the
        // current status stays silent.
        if ((status === "PAUSED" || status === "CANCELLED") && result.previousStatus !== status) {
            const freedIds = result.freedAppointmentIds;
            after(() => sendRecurringStatusNotice(id, status, "salon", freedIds));
        }
        const materialization = result.materialization;
        if (materialization) {
            after(() => sendRecurringResumedNotice(id, materialization));
        }

        // Re-read: a resume advances the watermark and may record new skips
        // after the status transaction, and the UI shows both.
        const refreshed = await prisma.recurringAppointment.findUnique({
            where: { id },
            include: {
                artist: true,
                service: true,
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
