import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/require-admin";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    let body: unknown;
    try {
        body = await request.json()
    } catch {
        return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        )
    }

    if (typeof body !== 'object' || body === null) {
        return Response.json(
            { error: 'Invalid request body' },
            { status: 400 }
        )
    }

    const { name, bio, photoUrl, active } = body as Record<string, unknown>

    if (name !== undefined && (typeof name !== 'string' || !name)) {
        return Response.json(
            { error: 'Name is invalid' },
            { status: 400 }
        )
    }

    if (bio !== undefined && bio !== null && typeof bio !== 'string') {
        return Response.json(
            { error: 'Bio is invalid' },
            { status: 400 }
        )
    }

    if (photoUrl !== undefined && photoUrl !== null && typeof photoUrl !== 'string') {
        return Response.json(
            { error: 'Photo URL is invalid' },
            { status: 400 }
        )
    }

    // Deactivate/reactivate both go through this same field — no separate
    // DELETE route, since a "delete" here is really just this update with
    // active: false (Artist is referenced by RESTRICT foreign keys the same
    // way Service is, so a real row deletion isn't an option once an artist
    // has any availability/appointments/etc.).
    if (active !== undefined && typeof active !== 'boolean') {
        return Response.json(
            { error: 'Active must be a boolean' },
            { status: 400 }
        )
    }

    const artist = await prisma.artist.findUnique({
        where: { id }
    })

    if (!artist) {
        return Response.json(
            { error: "Artist not found" },
            { status: 404 }
        )
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name;
    if (bio !== undefined) data.bio = bio;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;
    if (active !== undefined) data.active = active;

    try {
        const updatedArtist = await prisma.artist.update({
            where: { id: artist.id },
            data
        })

        return Response.json({ data: updatedArtist }, { status: 200 })
    } catch (error) {
        // Race between the findUnique above and this update — e.g. the row
        // was removed in between. Same pattern as admin/services.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: 'Artist not found' },
                { status: 404 }
            )
        }

        throw error
    }
}
