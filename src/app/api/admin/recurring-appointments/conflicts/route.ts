import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { findStandingConflicts } from "@/lib/booking";

// Read-only advisory check used by the admin booking wizard's review step:
// would booking this one-off take a week some ACTIVE standing appointment
// will claim but hasn't booked yet (past its booked-through date)? Returns
// the affected series so the UI can warn — never blocks anything.
//
// GET /api/admin/recurring-appointments/conflicts?artistId=&serviceId=&startTime=
export async function GET(request: NextRequest) {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;

    const params = request.nextUrl.searchParams;
    const artistId = params.get("artistId");
    const serviceId = params.get("serviceId");
    const startTimeParam = params.get("startTime");

    if (!artistId || !serviceId || !startTimeParam) {
        return Response.json({ error: "artistId, serviceId, and startTime are required" }, { status: 400 });
    }

    const startTime = new Date(startTimeParam);
    if (isNaN(startTime.getTime())) {
        return Response.json({ error: "startTime is invalid" }, { status: 400 });
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { durationMinutes: true } });
    if (!service) {
        return Response.json({ error: "Service not found" }, { status: 404 });
    }

    const conflicts = await findStandingConflicts(artistId, startTime, service.durationMinutes);
    return Response.json({ data: conflicts });
}
