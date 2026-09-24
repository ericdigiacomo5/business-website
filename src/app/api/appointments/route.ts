import { prisma } from "@/lib/prisma";
import { bookOccurrence } from "@/lib/booking";
import { auth } from "@/auth";
import { isBookingEnabled } from "@/lib/settings";

export async function POST(request: Request) {
    const session = await auth()
    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    const isAdmin = session.user.role === "ADMIN"

    // Admins always bypass the toggle — it exists to stop customer
    // self-booking (e.g. fully booked out, between seasons), not to stop
    // staff from booking appointments on the phone/in person.
    if (!isAdmin && !(await isBookingEnabled())) {
        return Response.json(
            { error: "Online booking is currently closed. Please contact the salon directly." },
            { status: 403 }
        )
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json(
            { error: 'Invalid JSON body' },
            { status: 400 }
        )
    }

    if (typeof body !== 'object' || body === null) {
        return Response.json(
            { error: 'Invalid request body' },
            { status: 400 }
        )
    }

    const { artistId, serviceId, startTime, userId: requestedUserId } = body as Record<string, unknown>

    // Only an admin's requested target user is honored — a non-admin's
    // userId is silently ignored (not rejected) so the customer-facing
    // contract is unchanged; isAdmin comes from the session, never from
    // this body, so a spoofed userId can't grant a spoofed override either.
    let targetUserId = session.user.id
    if (isAdmin && typeof requestedUserId === 'string' && requestedUserId) {
        targetUserId = requestedUserId
    }

    if (typeof artistId !== 'string' || !artistId) {
        return Response.json(
            { error: 'Artist is required' },
            { status: 400 }
        )
    }

    if (typeof serviceId !== 'string' || !serviceId) {
        return Response.json(
            { error: 'Service is required' },
            { status: 400 }
        )
    }

    if (typeof startTime !== 'string' && typeof startTime !== 'number') {
        return Response.json(
            { error: 'Time is required' },
            { status: 400 }
        )
    }

    const parsedStartTime = new Date(startTime)
    const isOnSlotGrid =
        parsedStartTime.getMinutes() % 15 === 0 &&
        parsedStartTime.getSeconds() === 0 &&
        parsedStartTime.getMilliseconds() === 0
    const isInPast = parsedStartTime.getTime() < Date.now()
    if (isNaN(parsedStartTime.getTime()) || !isOnSlotGrid || (!isAdmin && isInPast)) {
        return Response.json(
            { error: 'Time is invalid' },
            { status: 400 }
        )
    }

    const [artist, service, user] = await Promise.all([
        prisma.artist.findUnique({ where: { id: artistId } }),
        prisma.service.findUnique({ where: { id: serviceId } }),
        prisma.user.findUnique({ where: { id: targetUserId } }),
    ])

    if (!artist) {
        return Response.json(
            { error: 'Artist not found' },
            { status: 400 }
        )
    }

    // A deactivated artist can't be booked by anyone, admins included — the
    // toggle above only gates whether booking is open at all, this is a
    // separate "this specific artist isn't bookable" check. The client is
    // expected to already filter deactivated artists out of any picker, but
    // this is the actual enforcement boundary — never trust that alone.
    if (!artist.active) {
        return Response.json(
            { error: 'Artist not found' },
            { status: 400 }
        )
    }

    if (!service) {
        return Response.json(
            { error: 'Service not found' },
            { status: 400 }
        )
    }

    if (!user) {
        return Response.json(
            { error: 'User not found' },
            { status: 400 }
        )
    }

    const result = await bookOccurrence({
        userId: targetUserId,
        artistId,
        serviceId,
        serviceDurationMinutes: service.durationMinutes,
        startTime: parsedStartTime,
        allowPast: isAdmin,
    })

    if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status })
    }

    return Response.json({ data: result.appointment }, { status: 201 });
}
