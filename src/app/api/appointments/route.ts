import { prisma } from "@/lib/prisma";
import { bookOccurrence } from "@/lib/booking";
import { requireUser } from "@/lib/require-user";

export async function POST(request: Request) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

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

    const { artistId, serviceId, startTime } = body as Record<string, unknown>

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
    if (isNaN(parsedStartTime.getTime()) || !isOnSlotGrid || isInPast) {
        return Response.json(
            { error: 'Time is invalid' },
            { status: 400 }
        )
    }

    const [artist, service, user] = await Promise.all([
        prisma.artist.findUnique({ where: { id: artistId } }),
        prisma.service.findUnique({ where: { id: serviceId } }),
        prisma.user.findUnique({ where: { id: userId } }),
    ])

    if (!artist) {
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
        userId,
        artistId,
        serviceId,
        serviceDurationMinutes: service.durationMinutes,
        startTime: parsedStartTime,
    })

    if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status })
    }

    return Response.json({ data: result.appointment }, { status: 201 });
}
