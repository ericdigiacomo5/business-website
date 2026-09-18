import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id: artistId } = await params

    const artist = await prisma.artist.findUnique({
        where: { id: artistId }
    })

    if (!artist) {
        return Response.json(
            { error: "Artist not found" },
            { status: 404 }
        )
    }

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

    const { imageUrl, caption } = body as Record<string, unknown>

    if (!imageUrl || typeof imageUrl !== 'string') {
        return Response.json(
            { error: 'Image URL is required' },
            { status: 400 }
        )
    }

    if (caption !== undefined && caption !== null && typeof caption !== 'string') {
        return Response.json(
            { error: 'Caption is invalid' },
            { status: 400 }
        )
    }

    const portfolioImage = await prisma.portfolioImage.create({
        data: {
            artistId,
            imageUrl,
            caption
        }
    })

    return Response.json(
        { data: portfolioImage },
        { status: 201 }
    )
}
