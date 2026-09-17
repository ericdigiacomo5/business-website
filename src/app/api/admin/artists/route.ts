import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(request: Request) {
    const notAuthorized = await requireAdmin()
    if (notAuthorized) {
        return notAuthorized
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

    const { name, bio, photoUrl } = body as Record<string, unknown>

    if (!name || typeof name !== 'string') {
        return Response.json(
            { error: 'Name is required' },
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

    const artist = await prisma.artist.create({
        data: {
            name: name,
            bio: bio,
            photoUrl: photoUrl
        }
    })

    return Response.json(
        { data: artist },
        { status: 201 }
    )
}
