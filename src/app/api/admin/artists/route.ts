import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { isCloudinaryUrl, optionalText, requiredText, TEXT_LIMITS } from "@/lib/validation";
import { readJsonObject } from "@/lib/request";

export async function POST(request: Request) {
    const notAuthorized = await requireAdmin()
    if (notAuthorized) {
        return notAuthorized
    }

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const name = requiredText(body.name, TEXT_LIMITS.artistName)
    if (name === null) {
        return Response.json(
            { error: 'Name is required' },
            { status: 400 }
        )
    }

    const bio = optionalText(body.bio, TEXT_LIMITS.bio)
    if (!bio.ok) {
        return Response.json(
            { error: `Bio must be text of at most ${TEXT_LIMITS.bio} characters` },
            { status: 400 }
        )
    }

    // Photos only ever come from the signed Cloudinary upload. "" or null
    // means "no photo".
    const { photoUrl } = body
    if (photoUrl !== undefined && photoUrl !== null && photoUrl !== '' &&
        !isCloudinaryUrl(photoUrl, process.env.CLOUDINARY_CLOUD_NAME)) {
        return Response.json(
            { error: 'Photo must be an uploaded image' },
            { status: 400 }
        )
    }

    const artist = await prisma.artist.create({
        data: {
            name,
            bio: bio.value ?? null,
            photoUrl: photoUrl ? (photoUrl as string) : null,
        }
    })

    return Response.json(
        { data: artist },
        { status: 201 }
    )
}
