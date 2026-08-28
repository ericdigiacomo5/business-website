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

    if (!artist) {
        return Response.json(
            { error: 'Artist not found' },
            { status: 404 }
        )
    }

    return Response.json(artist)
}
