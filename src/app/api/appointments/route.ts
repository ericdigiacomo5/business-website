import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getOpenSlots } from "@/lib/availability";

export async function POST(request: Request) {
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

    // SECURITY (temporary): userId is trusted straight from the request body,
    // with no auth to verify the request actually came from that user — right
    // now anyone can book (or later cancel) as anyone else. Deliberate
    // trade-off to unblock testing the booking transaction below; NextAuth is
    // next on the roadmap and MUST replace this with a session-derived id
    // before this route is exposed to real users.
    const { artistId, serviceId, startTime, userId } = body as Record<string, unknown>

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

    if (typeof userId !== 'string' || !userId) {
        return Response.json(
            { error: 'User is required' },
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

    const endTime = new Date(parsedStartTime.getTime() + (service.durationMinutes * 60_000))

    const SLOT_DURATION_MS = 15 * 60_000
    const slots: Date[] = []
    let current = parsedStartTime
    while (current < endTime) {
        slots.push(current);
        current = new Date(current.getTime() + SLOT_DURATION_MS)
    }

    const openSlots = await getOpenSlots(artistId, parsedStartTime)
    const openSlotTimes = new Set(openSlots.map((slot) => slot.getTime()))
    const isFullyAvailable = slots.every((slot) => openSlotTimes.has(slot.getTime()))

    if (!isFullyAvailable) {
        return Response.json(
            { error: 'That time is not available' },
            { status: 400 }
        )
    }

    try {

        const appointment = await prisma.$transaction(async (tx) => {
            const appointment = await tx.appointment.create({
                data: {
                    userId: userId,
                    artistId: artistId,
                    serviceId: serviceId,
                    startTime: parsedStartTime,
                    endTime: endTime
                }
            })

            await tx.appointmentSlot.createMany({
                data: slots.map((slotStart) => ({
                    artistId: artistId,
                    slotStart: slotStart,
                    appointmentId: appointment.id
                }))
            })

            return appointment
        })

        return Response.json({ data: appointment }, { status: 201 });
    } catch (error) {

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return Response.json(
                { error: 'That time was just booked, please pick another' },
                { status: 409 }
            )
        }

        throw error
    }

}
