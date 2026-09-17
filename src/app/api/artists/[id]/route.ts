import { prisma } from "@/lib/prisma"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const artist = await prisma.artist.findUnique({
        where: { id },
        include: { portfolio: true }
    })

    // Treat a deactivated artist as not found for this public-facing route —
    // matches the "inactive = hidden from customers" rule GET /api/services
    // already applies via `where: { active: true }`. No listing to filter
    // here (this is a single-id lookup), so the check happens post-fetch.
    if (artist && !artist.active) {
        return Response.json(
            { error: 'Artist not found' },
            { status: 404 }
        )
    }

    if (!artist) {
        return Response.json(
            { error: 'Artist not found' },
            { status: 404 }
        )
    }

    return Response.json(artist)
}
